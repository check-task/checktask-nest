# Architecture

checktask-nest의 폴더 구조와 코드 아키텍처 규칙입니다. 새 코드를 작성하기 전에 이 문서를 먼저 확인합니다.

- 코드 스타일·네이밍·응답/에러 규칙: [`CODE_CONVENTION.md`](CODE_CONVENTION.md)
- 브랜치·커밋·PR 규칙: [`GITHUB_CONVENTION.md`](GITHUB_CONVENTION.md)

이 프로젝트는 Express + Prisma 레거시(`checktask-back`)를 NestJS로 옮기는 마이그레이션입니다. **DB(Check_Task_DB)는 레거시와 같은 것을 그대로 사용**합니다.
`(예정)`이 붙은 항목은 규칙은 확정됐지만 아직 코드가 없는 것입니다. 처음 구현하는 사람이 이 문서대로 만듭니다.

## 기술 스택

- NestJS 12 (CommonJS) + TypeScript
- TypeORM + MySQL (스키마 변경은 마이그레이션으로만)
- Redis (ioredis), AWS S3 (Presigned URL)
- 인증: JWT (Passport) — Access Token 검증은 전역(`common/auth`), 발급은 `auth` 도메인
- 실행: PM2 cluster 모드 (`instances: 'max'`) → **서버 인스턴스가 여러 개 뜬다는 전제로 설계**합니다
- 테스트: Vitest / 린트: oxlint / 포맷: Prettier

---

## 폴더 구조

Nest는 기능(도메인) 단위로 모듈을 나눠서 관리합니다.

```
src/
├── auth/
├── users/
├── folders/
├── tasks/
├── comments/
├── references/
├── alarms/
├── health/                         # 서버 상태 확인 (GET /api/v1/health)
├── common/                         # 여러 도메인이 공유하는 기반 코드 (도메인 로직 금지)
│   ├── auth/                       # 전역 토큰 "검증"
│   │   ├── guards/                   jwt-auth.guard.ts          (전역 인증 가드, @Public() 예외)
│   │   ├── strategies/               jwt.strategy.ts            (Access Token 검증)
│   │   ├── decorators/               current-user.decorator.ts / public.decorator.ts
│   │   └── jwt-auth.module.ts        (@Global)
│   ├── database/                   data-source.ts              (TypeORM 설정)
│   ├── migrations/                 (예정) {timestamp}-{이름}.ts  (TypeORM 마이그레이션)
│   ├── enums/                      {이름}.enum.ts + index.ts    (여러 도메인 공용 enum)
│   ├── pagination/                 (예정) 커서·오프셋 공용 요청/응답 DTO
│   ├── utils/                      (예정) date.util.ts 등 순수 함수
│   ├── redis/                      redis.module.ts / redis.service.ts   (@Global)
│   ├── s3/                         s3.module.ts / s3.service.ts         (@Global)
│   ├── fcm/                        (예정) fcm.module.ts / fcm.service.ts (@Global, 푸시 발송 클라이언트)
│   ├── mail/                       (예정) mail.module.ts / mail.service.ts (@Global, 메일 발송 클라이언트)
│   └── response/
│       ├── success/                  response.interceptor.ts / success-code.ts / kst.interceptor.ts
│       └── error/                    error.filter.ts / error-code.ts / custom.error.ts
├── app.module.ts
└── main.ts
```

### 도메인 폴더 내부 구성

엔티티가 1개뿐인 도메인 (예: `folders`)

```
folders/
├── folder.entity.ts
├── folder.dto.ts
├── folder.controller.ts
├── folder.service.ts
└── folder.module.ts
```

엔티티가 2개 이상인 도메인 (예: `references`)

```
references/
├── entities/
│   ├── reference.entity.ts
│   ├── log.entity.ts
│   └── communication.entity.ts
├── reference.dto.ts
├── reference.controller.ts
├── reference.service.ts
└── reference.module.ts
```

cron·소켓이 필요한 도메인은 `<도메인 단수>.scheduler.ts`, `<도메인 단수>.gateway.ts`를 추가합니다. (예: `alarms/alarm.scheduler.ts`)

### 도메인 목록 (레거시 대응)

| Nest 도메인 | 레거시 대응 | 비고 |
|---|---|---|
| `auth` | auth / login / token | 회원가입·로그인·카카오·토큰 발급/재발급 |
| `users` | user | 유저, 약관 동의, 디바이스, 알림 설정 |
| `folders` | user/folder | |
| `tasks` | task / member | 과제, 세부 과제, 우선순위, 과제 참여자 |
| `comments` | comment | |
| `references` | modal (`/reference`) | 레거시 이름 `modal` → 실제 의미인 `references`로 변경 |
| `alarms` | alarm + cron | `alarm.scheduler.ts`에서 마감 알림 발송 |

도메인 이름·경계는 실제 이관할 때 조정할 수 있습니다. 조정하면 위 폴더 구조와 이 표를 함께 고칩니다.

### 규칙

- **하나의 도메인 = 하나의 모듈**: 도메인의 `.module.ts`에서 해당 컨트롤러·서비스를 등록합니다.
- **도메인 폴더명**은 복수형 kebab-case, **파일명**은 `<도메인명 단수>.<역할>.ts`입니다. (예: `tasks/task.service.ts`)
- **엔티티**: 2개 이상이면 `entities/` 서브폴더로 분리하고 파일명은 `<테이블명-kebab-case>.entity.ts`, 1개뿐이면 서브폴더 없이 둡니다.
  - 파일명이 `*.entity.ts`여야 `data-source.ts`의 glob에 잡혀 자동 등록됩니다. (서브폴더 포함)
- **DTO**: 요청·응답 DTO가 여러 개여도 하나의 `<도메인>.dto.ts`에 모아서 작성합니다. (예: `task.dto.ts` 안에 `CreateTaskDto`, `UpdateTaskDto`, `TaskResponseDto`)
- **common과 도메인의 경계**: `common/`에는 여러 도메인에서 공유하는 것만 둡니다. `common/`은 도메인을 import하지 않습니다.
- **외부 연동 vs 실행 주체**: 외부 서비스 "클라이언트"(Redis, S3, FCM, 메일)는 `common/`에, 그것을 "언제·왜 호출하는지"(cron 잡, 소켓 이벤트)는 해당 도메인에 둡니다.
  - 예: 푸시 발송 함수는 `common/fcm/fcm.service.ts`, 5분마다 마감 알림을 찾는 잡은 `alarms/alarm.scheduler.ts`
- **도메인 간 참조**: 다른 도메인의 서비스가 필요하면 해당 모듈을 `imports`에 등록하고, 그 모듈은 `exports`로 서비스를 공개합니다. 순환 의존이 생기면 `forwardRef`로 풀지 말고 책임을 다시 나눕니다.
- **common 내부 폴더명**: 종류별 폴더는 복수형(`guards/`, `strategies/`, `decorators/`, `enums/`, `migrations/`, `utils/`), 기능 이름 폴더(`redis/`, `s3/`, `response/`, `pagination/`)는 그대로 둡니다.
- **enum**: 한 도메인에서만 쓰면 도메인 폴더에, 여러 도메인이 쓰면 `common/enums/`에 두고 `index.ts`에서 re-export 합니다. enum 파일은 다른 파일을 import하지 않습니다. (순환 참조 방지)
- **테스트**: `*.spec.ts`는 대상 파일 옆에 둡니다. e2e 테스트는 `test/`에 둡니다.

---

## 코드 아키텍처

```
Request → Guard(인증) → Pipe(DTO 검증·변환) → Controller → Service → Repository(TypeORM)
                                                                         ↓
Response ← ResponseInterceptor(SUCCESS 래핑) ← KstInterceptor(Date→KST) ← { message, data: ResponseDto }
         ← GlobalExceptionFilter(FAIL 변환) ← throw CustomError (NotFoundError 등)
```

### 레이어별 책임

| 레이어 | 담당 | 하지 않는 것 |
|---|---|---|
| Module | 의존성 등록 (`imports`·`controllers`·`providers`·`exports`) | 로직 |
| Controller | 라우팅, Swagger 문서화, DTO·`@CurrentUser()` 받기, Service 호출, `{ message, data }` 반환 | 비즈니스 로직, DB 접근, try/catch, 응답 래핑 |
| Service | 비즈니스 로직(비즈니스 규칙 검증, DB 접근, 외부 API 호출), 트랜잭션, 엔티티 → Response DTO 변환, 실패 시 예외 throw | `req`/`res` 접근, 응답 envelope 구성, try/catch로 예외 삼키기 |
| Entity | 테이블·컬럼·관계 정의 (기존 DB에 맞춰 매핑) | 로직 |
| Request DTO | 요청 형태 정의 + 필수값·형식 검증 (`class-validator`) + Swagger (`@ApiProperty`) | 비즈니스 규칙 검증 |
| Response DTO | 응답에 노출할 필드 정의 + Swagger + 엔티티 변환(`from`) | DB 접근 |
| Scheduler / Gateway | cron 트리거, 소켓 이벤트 수신 → Service 호출 | 비즈니스 로직 (Controller와 같은 위치의 진입점) |

### 검증 위치

| 검증 | 위치 | 예시 |
|---|---|---|
| 필수값 존재·타입·형식 | Controller (DTO 데코레이터, Pipe) | `@IsNotEmpty()`, `@Param('id', ParseIntPipe)` |
| 비즈니스 규칙 | Service | 마감일 역전, 중복 이름, 폴더 개수 제한, 권한 |

### Module

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Task]), FolderModule],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService], // 다른 도메인에서 쓸 때만
})
export class TaskModule {}
```

- Redis·S3·FCM·메일·JWT 검증은 `common/`의 전역 모듈이 제공하므로 도메인 Module에서 다시 등록하지 않습니다.
- 새 도메인 Module은 `app.module.ts`의 `imports`에 등록합니다.

### Controller

하나의 컨트롤러는 하나의 도메인 라우트만 담당합니다. (`TaskController`는 과제 관련 라우트만)

```ts
@ApiTags('Task')
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(SuccessCode.CREATED.status)
  @ApiOperation({ summary: '과제 생성' })
  async createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: UserPayload) {
    const data = await this.taskService.createTask(dto, user.id);
    return { message: '과제 생성 성공', data };
  }
}
```

- **라우팅 prefix**: 새 리소스는 `@Controller('folders')`처럼 도메인명 복수형 kebab-case를 쓰고, **마이그레이션 대상 API는 기존 경로를 유지**합니다. (`api/v1`은 `main.ts`에서 전역 설정)
- 사용자 식별값은 **반드시 `@CurrentUser()`** 에서 꺼냅니다. body·query의 userId는 신뢰하지 않습니다.
- 인증이 필요 없는 API에만 `@Public()`을 붙입니다.
- 응답 쿠키 등 `res`가 꼭 필요하면 `@Res({ passthrough: true })`로 받아 인터셉터 래핑을 유지합니다.
- 경로 파라미터의 숫자 id는 `@Param('id', ParseIntPipe) id: number`로 받습니다.

### Service

```ts
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  /**
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_PERSONAL_TASK) - 다른 사용자의 개인 과제일 때
   */
  async updateTask(id: number, dto: UpdateTaskDto, userId: number): Promise<TaskResponseDto> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundError('TASK_NOT_FOUND', '요청한 과제가 존재하지 않습니다.');
    if (task.userId !== userId) throw new ForbiddenError('FORBIDDEN_PERSONAL_TASK', '다른 사용자의 개인 과제입니다.');
    const saved = await this.taskRepository.save({ ...task, ...dto });
    return TaskResponseDto.from(saved);
  }
}
```

- 모든 서비스에 `@Injectable()`을 붙이고, 의존성은 `constructor(private readonly xxxService: XxxService)`로 주입받습니다.
- 메서드명은 컨트롤러 메서드와 1:1로 맞춥니다. (`getTaskDetail` ↔ `getTaskDetail`)
- 검사 순서는 **존재 확인 → 권한 확인 → 실행**으로 고정합니다.
- Service는 엔티티를 그대로 반환하지 않고 **Response DTO로 변환해서 반환**합니다.
- 여러 쓰기 작업이 함께 성공해야 하면 `dataSource.transaction()`으로 묶습니다. (하나라도 실패하면 전체 롤백)
- 연관 데이터는 반복문 안에서 따로 조회하지 않고 `relations`나 JOIN으로 한 번에 가져옵니다. (N+1 방지)
- 목록 API는 페이지네이션을 적용하고([페이지네이션](#페이지네이션-예정) 참고), 필요한 컬럼만 `select`합니다. 나머지는 상세 조회에서 가져옵니다.
- 반복문 안에서 `save()`하지 않습니다. 배열로 모아 한 번에 저장합니다. (쓰기 N+1 방지)
- 서로 의존하지 않는 비동기 작업은 `Promise.all`로 병렬 실행합니다.
- 서버 메모리(모듈 변수, Map 등)에 상태를 저장하지 않습니다. 인스턴스가 여러 개라 공유되지 않으므로 Redis를 씁니다.

### DTO

```ts
// task.dto.ts

// 요청
export class CreateTaskDto {
  @ApiProperty({ example: '중간 발표 준비' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '2026-10-20T23:59:00+09:00' })
  @IsISO8601({ strict: true })
  @Type(() => Date)
  deadline: Date;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

// 응답
export class TaskResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty({ example: '2026-10-20T23:59:00.000+09:00' }) deadline: Date;

  static from(task: Task): TaskResponseDto {
    const dto = new TaskResponseDto();
    dto.id = task.id;
    dto.title = task.title;
    dto.deadline = task.deadline;
    return dto;
  }
}
```

- 클래스명: 요청은 `{동작}{대상}Dto` (`CreateTaskDto`, `GetTasksQueryDto`), 응답은 `{대상}ResponseDto` 또는 `{대상}{용도}ResponseDto` (`TaskResponseDto`, `TaskDetailResponseDto`)
- 응답 DTO는 엔티티에서 **노출할 필드만 명시적으로 복사**합니다. (`Object.assign(dto, entity)` 금지 — 민감 컬럼이 새어 나감)
- 응답의 Date 필드는 `Date` 타입 그대로 둡니다. KST 문자열 변환은 `KstInterceptor`가 합니다.

### Entity

기존 DB(Prisma가 만든 스키마)에 맞춰 매핑합니다. 테이블명은 PascalCase, 컬럼명은 snake_case, PK는 `{테이블}_id` 자동 증가 정수입니다.

```ts
@Entity('Task')
export class Task {
  @PrimaryGeneratedColumn({ name: 'task_id' }) id: number;
  @Column({ length: 100 }) title: string;
  @Column({ name: 'user_id' }) userId: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true }) updatedAt: Date | null;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true }) deletedAt: Date | null;
}
```

- 프로퍼티는 camelCase, DB 컬럼명이 다르면 `name`으로 명시합니다.
- 새 테이블을 만들 때도 같은 규칙(PascalCase 테이블, snake_case 컬럼, `{테이블}_id` PK)을 따릅니다.
- 비밀번호 등 민감 컬럼은 `select: false`로 기본 조회에서 제외합니다.
- WHERE·ORDER BY·JOIN에 쓰는 컬럼에는 인덱스를 거는 것을 우선 고려합니다.
- 관계에 `eager: true`를 쓰지 않습니다. 필요한 조회에서만 `relations`로 명시합니다.
- soft delete가 있는 테이블(`deleted_at`)은 `@DeleteDateColumn` + `softDelete()`를 씁니다.

---

## 데이터 · 인프라 정책

### DB 스키마 관리 — 마이그레이션만 사용 (예정)

- **모든 환경에서 `synchronize: false`** 입니다. 엔티티를 고쳐도 DB는 자동으로 바뀌지 않습니다.
- 스키마 변경은 `src/common/migrations/`의 TypeORM 마이그레이션 파일로만 합니다.
- 마이그레이션은 생성 후 **SQL을 직접 읽고 검토**합니다. 기존 테이블의 DROP·컬럼 타입 변경이 들어 있으면 의도한 것인지 확인합니다.
- 첫 마이그레이션은 기존 DB를 기준선(baseline)으로 삼습니다. 엔티티가 기존 스키마와 정확히 맞으면 generate 결과가 비어 있어야 정상입니다.
- 배포 시 `migration:run` → 서버 재시작 순서로 실행합니다.

### 시간대 — 입력 KST · 내부 UTC · 출력 KST

| 구간 | 기준 | 형식 |
|---|---|---|
| 프론트 → 백엔드 (요청) | KST | ISO 8601 + 오프셋 필수: `2026-10-20T23:59:00+09:00` |
| 백엔드 내부 · DB | UTC | JS `Date`, DB `timestamp` |
| 백엔드 → 프론트 (응답) | KST | `2026-10-20T23:59:00.000+09:00` |

- **요청**: DTO에서 `@IsISO8601({ strict: true })` + `@Type(() => Date)`로 받습니다. 오프셋이 붙어 있으므로 `Date`로 변환되는 순간 UTC 시각이 됩니다. 오프셋 없는 문자열은 의미가 모호하므로 받지 않습니다.
- **내부**: Service·Repository에서는 UTC `Date`만 다룹니다. `Date.now() + 9시간` 같은 수동 보정은 하지 않습니다.
- **"오늘", "마감 N일 전" 같은 날짜 경계**는 KST 기준으로 계산해야 하므로 `common/utils/date.util.ts`(예정) 한 곳에서만 처리합니다.
- **응답**: `KstInterceptor`(예정 — 현재 주석만 있음)가 응답 data 안의 모든 `Date`를 `+09:00` 오프셋 문자열로 바꿉니다. Date에 9시간을 더하는 방식은 쓰지 않습니다. (끝에 `Z`가 붙어 실제 시각과 달라짐)
  - 등록: `app.useGlobalInterceptors(new ResponseInterceptor(), new KstInterceptor())` (응답 처리는 등록 역순이므로 KST 변환 후 래핑)
- **DB 연결**: `data-source.ts`에 `timezone: 'Z'`를 지정해 드라이버가 UTC로 읽고 쓰게 합니다. DB 서버 시간대도 UTC로 둡니다.

### 페이지네이션

커서·오프셋 두 가지를 `common/pagination/`에 규격화하고, API 성격에 따라 고릅니다.

| | 커서 | 오프셋 |
|---|---|---|
| 언제 | 무한 스크롤, 알림처럼 계속 쌓이는 목록 | 페이지 번호 UI, 전체 개수가 필요한 목록 |
| 요청 query | `?cursor=&limit=` | `?page=&size=` (page는 1부터) |
| 응답 data | `{ items, nextCursor, hasNext }` | `{ items, page, size, totalCount }` |
| 요청 DTO | `CursorPaginationQueryDto` | `OffsetPaginationQueryDto` |

- 커서는 정렬 기준 컬럼(기본 PK)의 마지막 값입니다. `limit + 1`개를 조회해 `hasNext`를 판단합니다.
- `limit`·`size`는 기본값과 최대값을 DTO에서 정합니다. (상한 없이 받지 않음)
- 목록 API별 query DTO는 공용 DTO를 상속해 필터 필드를 추가합니다.

### Redis 사용 규칙

- 키 형식: `{용도}:{식별자}` snake_case (예: `refresh_token:{tokenId}`, `pushed_alarm:{alarmId}`)
- 모든 키에 TTL을 겁니다. 영구 저장이 필요한 데이터는 DB에 둡니다.
- `KEYS *`를 쓰지 않습니다. 패턴 조회가 필요하면 `SCAN`을 쓰거나, 조회 가능한 인덱스 키를 따로 둡니다.

### 스케줄러 · 소켓

- cron 잡은 `@nestjs/schedule`의 `@Cron()`으로 도메인의 `<도메인 단수>.scheduler.ts`에 작성하고, 실제 로직은 Service에 둡니다.
- PM2 cluster 모드에서는 **모든 인스턴스가 같은 cron을 동시에 실행**합니다. 잡 시작 시 Redis 락(`SET key value NX EX ttl`)을 잡은 인스턴스만 실행합니다.
- 소켓 게이트웨이는 도메인의 `<도메인 단수>.gateway.ts`에 둡니다. 인스턴스 간 이벤트 공유를 위해 Redis adapter를 씁니다.

---

## 전역 설정 (main.ts)

- Prefix: `/api/v1`
- 전역 적용: `GlobalExceptionFilter`, `ResponseInterceptor`(+ `KstInterceptor` 예정), `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, `JwtAuthGuard`
- Swagger: `/docs` (운영 환경은 Basic Auth — `SWAGGER_USER`, `SWAGGER_PASSWORD` 필수)
- 응답 형식·에러 코드: [`CODE_CONVENTION.md`](CODE_CONVENTION.md#4-응답-구조)

---

## 현재 코드와 맞춰야 할 부분

이 문서와 `CODE_CONVENTION.md`의 규칙과 아직 다른 코드입니다. 해당 작업을 할 때 함께 고칩니다.

| 위치 | 현재 | 맞출 내용 |
|---|---|---|
| `common/database/data-source.ts` | 개발 환경 `synchronize: true`, `timezone` 미지정 | `synchronize: false`, `timezone: 'Z'`, `migrations` 경로 추가 + 마이그레이션 npm 스크립트 |
| `common/response/success/kst.interceptor.ts` | 주석만 있음 | `+09:00` 문자열 변환 구현 후 `main.ts`에 등록 |
| `common/response/error/error-code.ts` | HTTP 상태 코드만 있음 | `CODE_CONVENTION.md`의 도메인 에러 코드(`TASK_NOT_FOUND` 등) 추가 |
| `common/auth/decorators/current-user.decorator.ts` | `UserPayload.id: string` | 기존 DB의 user_id가 정수이므로 `number`로 변경 |
| `common/auth/strategies/jwt.strategy.ts` | payload `{ sub, email }` 기대 | `auth` 도메인 구현 시 발급 payload와 맞춤 (레거시는 `{ id, provider, providerId }`) |
| `app.module.ts` | `TypeOrmModule.forRootAsync`에 `imports: undefined` | 불필요한 속성 제거 |
| `common/pagination/`, `common/migrations/`, `common/utils/`, `common/fcm/`, `common/mail/` | 없음 | 처음 필요한 도메인을 구현할 때 생성 |
