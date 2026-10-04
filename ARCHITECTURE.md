# Architecture

checktask-nest의 폴더 구조와 코드 아키텍처 규칙입니다. 새 코드를 작성하기 전에 이 문서를 먼저 확인합니다.

## 기술 스택

- NestJS 12 (CommonJS) + TypeScript
- TypeORM + MySQL
- Redis (ioredis), AWS S3 (Presigned URL)
- 인증: JWT (Passport) — Access Token 검증은 전역, 발급은 `auth` 도메인
- 테스트: Vitest / 린트: oxlint / 포맷: Prettier

---

## 폴더 구조

```
src/
├── common/                     # 모든 도메인이 사용하는 공용 기반 코드 (도메인 로직 금지)
│   ├── auth/                   # 전역 토큰 "검증"
│   │   ├── guards/               jwt-auth.guard.ts        (전역 인증 가드, @Public() 예외)
│   │   ├── strategies/           jwt.strategy.ts          (Access Token 검증)
│   │   ├── decorators/           current-user.decorator.ts / public.decorator.ts
│   │   └── jwt-auth.module.ts    (@Global)
│   ├── database/               data-source.ts              (TypeORM 설정)
│   ├── enums/                  {이름}.enum.ts              (여러 도메인 공용 문자열 enum)
│   ├── redis/                  redis.module.ts / redis.service.ts   (@Global)
│   ├── s3/                     s3.module.ts / s3.service.ts         (@Global)
│   └── response/
│       ├── success/              response.interceptor.ts / success-code.ts / kst.interceptor.ts
│       └── error/                error.filter.ts / error-code.ts / custom.exception.ts
├── {domain}/                       # 도메인 별 폴더
│   ├── dtos/
│   └── {domain}.entity.ts / {domain}.module.ts / {domain}.controller.ts / {domain}.service.ts
├── health/                     # 서버 상태 확인 (GET /api/v1/health)
├── app.module.ts
└── main.ts
```

### 규칙

- **common과 도메인의 경계**: `common/`은 도메인을 import하지 않습니다. 도메인은 `common/`만 import하고, 다른 도메인 Service가 필요하면 해당 Module의 `exports`로 공개된 것만 사용합니다.
- **폴더명**: 종류별 폴더는 복수형을 씁니다 (`dtos/`, `guards/`, `strategies/`, `decorators/`, `enums/`). 기능 이름 폴더(`redis/`, `s3/`, `response/`)는 그대로 둡니다.
- **파일명**: kebab-case + 역할 접미사 (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.entity.ts`, `*.dto.ts`, `*.guard.ts`, `*.strategy.ts`, `*.enum.ts`).
- **엔티티**: 파일명이 `*.entity.ts`여야 `data-source.ts`의 glob에 잡혀 자동 등록됩니다. 도메인 Module에서는 `TypeOrmModule.forFeature([...])`로 Repository를 주입받습니다.
- **enum**: 한 도메인에서만 쓰면 도메인 폴더에, 여러 도메인이 쓰면 `common/enums/`에 둡니다. enum 파일은 다른 파일을 import하지 않습니다 (순환 참조 방지).
- **테스트**: `*.spec.ts`는 대상 파일 옆에 둡니다. e2e 테스트는 `test/`에 둡니다.

---

## 코드 아키텍처

```
Request → Guard(인증) → Pipe(DTO 검증) → Controller → Service → Repository(TypeORM)
                                                                    ↓
Response ← ResponseInterceptor(SUCCESS 래핑) ← { message, data } ←──┘
         ← GlobalExceptionFilter(FAIL 변환) ← throw Exception
```

### 레이어별 책임

| 레이어 | 담당 | 하지 않는 것 |
|---|---|---|
| Module | 의존성 등록 (`imports`·`controllers`·`providers`·`exports`) | 로직 |
| Controller | 라우팅, Swagger 문서화, DTO·`@CurrentUser()` 받기, Service 호출, `{ message, data }` 반환 | 비즈니스 로직, Repository 직접 접근, try/catch |
| Service | 비즈니스 로직, Repository 호출, 트랜잭션, 실패 시 예외 throw | `req`/`res` 접근, 응답 포맷 구성 |
| Entity | 테이블·컬럼·관계 정의 | 로직 |
| DTO | 요청 형태 정의 + 검증 (`class-validator`) + Swagger (`@ApiProperty`) | 로직 |

### Module

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService], // 다른 도메인에서 쓸 때만
})
export class PostModule {}
```

- Redis·S3·JWT 검증은 `common/`의 전역 모듈이 제공하므로 도메인 Module에서 다시 등록하지 않습니다.

### Controller

```ts
@ApiTags('Post')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @HttpCode(SuccessCode.CREATED.status)
  @ApiOperation({ summary: '게시글 생성' })
  async create(@Body() dto: CreatePostDto, @CurrentUser() user: UserPayload) {
    const data = await this.postService.create(dto, user.id);
    return { message: '게시글 생성 성공', data };
  }
}
```

- 사용자 식별값은 **반드시 `@CurrentUser()`** 에서 꺼냅니다. body·query의 userId는 신뢰하지 않습니다.
- 인증이 필요 없는 API에만 `@Public()`을 붙입니다.
- 응답 쿠키 등 `res`가 꼭 필요하면 `@Res({ passthrough: true })`로 받아 인터셉터 래핑을 유지합니다.

### Service

```ts
@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  /**
   * @throws CustomException(NOT_FOUND) - 게시글이 없을 때
   * @throws CustomException(FORBIDDEN) - 작성자가 아닐 때
   */
  async update(id: string, dto: UpdatePostDto, userId: string) {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) throw new CustomException(ErrorCode.NOT_FOUND, '게시글이 존재하지 않습니다.');
    if (post.userId !== userId) throw new CustomException(ErrorCode.FORBIDDEN);
    return this.postRepository.save({ ...post, ...dto });
  }
}
```

- 검사 순서는 **존재 확인 → 권한 확인 → 실행**으로 고정합니다.
- 여러 쓰기 작업이 함께 성공해야 하면 `dataSource.transaction()`으로 묶습니다. (하나라도 실패하면 전체 롤백)
- 연관 데이터는 반복문 안에서 따로 조회하지 않고 `relations`나 JOIN으로 한 번에 가져옵니다. (N+1 방지)
- 목록 API는 페이지네이션을 우선적으로 고려합니다.
- 목록에서는 필요한 컬럼만 `select`합니다. 나머지는 상세 조회에서 가져옵니다.
- 반복문 안에서 `save()`하지 않습니다. 배열로 모아 한 번에 저장합니다. (쓰기 N+1 방지)
- 서로 의존하지 않는 비동기 작업은 `Promise.all`로 병렬 실행합니다.

### DTO

```ts
export class CreatePostDto {
  @ApiProperty({ example: '제목' })
  @IsString()
  @IsNotEmpty()
  title: string;
}
```

- 파일명은 `{동작}-{대상}.dto.ts` (예: `create-post.dto.ts`, `login.dto.ts`), 도메인의 `dtos/`에 둡니다.

### Entity

```ts
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 100 }) title: string;
  @Column() userId: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

- 비밀번호 등 민감 컬럼은 `select: false`로 기본 조회에서 제외합니다.
- WHERE·ORDER BY·JOIN에 쓰는 컬럼에는 인덱스를 거는 것을 우선 고려합니다.
- 관계에 `eager: true`를 쓰지 않습니다. 필요한 조회에서만 `relations`로 명시합니다.

---

## 기타

### 주석

- 메서드에는 JSDoc(역할, `@throws`), 로직에는 한국어 인라인 주석을 씁니다. 자명한 코드에는 생략합니다.

### 응답 형식

```jsonc
// 성공 — 컨트롤러는 { message, data }만 반환, resultType은 인터셉터가 붙임
{ "resultType": "SUCCESS", "message": "string", "data": { } }

// 실패 — GlobalExceptionFilter가 변환
{ "resultType": "FAIL", "code": 500, "errorCode": "INTERNAL_SERVER_ERROR", "reason": "서버 내부 오류가 발생했습니다", "data": null }
```

- `reason`은 항상 문자열입니다. ValidationPipe 메시지 배열은 `', '`로 이어 붙입니다.
- 에러 코드: `common/response/error/error-code.ts` (`errorCode` = HttpStatus 이름)
- 성공 코드: `common/response/success/success-code.ts` (`@HttpCode(SuccessCode.CREATED.status)`)

```ts
throw new CustomException(ErrorCode.NOT_FOUND, '게시글이 존재하지 않습니다.');
```

### 전역 설정 (main.ts)

- Prefix: `/api/v1`
- 전역 적용: `GlobalExceptionFilter`, `ResponseInterceptor`, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, `JwtAuthGuard`
- Swagger: `/docs`
