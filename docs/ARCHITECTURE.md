# Architecture

checktask-nest의 폴더 구조와 코드 아키텍처 규칙입니다. 새 코드를 작성하기 전에 이 문서를 먼저 확인합니다.

- 코드 스타일·네이밍·응답/에러 규칙: [`CODE_CONVENTION.md`](CODE_CONVENTION.md)
- `src/common/` 공용 모듈 사용법: [`COMMON.md`](COMMON.md)
- 브랜치·커밋·PR 규칙: [`GITHUB_CONVENTION.md`](GITHUB_CONVENTION.md)

이 프로젝트는 Express + Prisma 레거시(`checktask-back`)를 NestJS로 옮기는 마이그레이션입니다. **DB(Check_Task_DB)는 레거시와 같은 것을 그대로 사용**합니다.

## 기술 스택

- NestJS 12 (CommonJS) + TypeScript
- TypeORM + PostgreSQL (`pg`, 스키마 변경은 마이그레이션으로만)
- Redis (ioredis), AWS S3 (Presigned URL)
- 인증: JWT (Passport) — Access Token 검증은 전역(`common/auth`), 발급은 `auth` 도메인 ([COMMON auth](COMMON.md#auth))
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
├── common/                         # 여러 도메인이 공유하는 기반 코드 (도메인 로직 금지) → 상세 구성: COMMON.md
│                                     auth / config / database / decorators / migrations / enums / pagination / utils / redis / s3 / fcm / mail / response
├── app.module.ts
└── main.ts

test/                               # 테스트 코드 (src/에는 두지 않음) → CODE_CONVENTION.md 7. 테스트
└── unit/                           # src/ 구조를 그대로 따라감
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
- **common 내부 폴더명·enum 배치**: [`COMMON.md`](COMMON.md#작성-규칙), [enums](COMMON.md#enums) 참고
- **테스트**: `src/`에는 실제 코드만 두고, 테스트는 `test/unit/`(src 구조 그대로)에 둡니다. ([CODE_CONVENTION 7. 테스트](CODE_CONVENTION.md#7-테스트) 참고)

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
| Service | 비즈니스 로직(비즈니스 규칙 검증, DB 접근, 외부 API 호출), 트랜잭션, 실패 시 예외 throw | `req`/`res` 접근, 응답 envelope 구성, try/catch (외부 API 호출만 예외 — [CODE_CONVENTION 5. 에러 처리](CODE_CONVENTION.md#5-에러-처리)) |
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
  @HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API는 200 유지 (CODE_CONVENTION 성공 상태 코드 참고)
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
- Service의 반환값은 컨트롤러가 `{ message, data }`의 `data`에 담습니다. (응답 형식은 [CODE_CONVENTION 4. 응답 구조](CODE_CONVENTION.md#4-응답-구조)를 따릅니다)
- 여러 쓰기 작업이 함께 성공해야 하면 `dataSource.transaction()`으로 묶습니다. (하나라도 실패하면 전체 롤백)
- 연관 데이터는 반복문 안에서 따로 조회하지 않고 `relations`나 JOIN으로 한 번에 가져옵니다. (N+1 방지)
- 목록 API는 페이지네이션을 적용하고([COMMON pagination](COMMON.md#pagination) 참고), 필요한 컬럼만 `select`합니다. 나머지는 상세 조회에서 가져옵니다.
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

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-20T23:59:00+09:00' })
  @IsOffsetDateTime() // common/decorators — 오프셋 없는 날짜는 400 (COMMON 시간대 참고)
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
- 요청 DTO에 선언하지 않은 필드는 400 없이 **조용히 제거**됩니다. (레거시와 동일) 그래서 서비스에서 쓰는 필드는 body·query 모두 빠짐없이 DTO에 선언해야 합니다. 선언하지 않으면 값이 사라져 `undefined`가 됩니다.
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
- enum 컬럼은 기존 PostgreSQL enum 타입 이름을 `enumName`으로 지정합니다. 생략하면 TypeORM이 `task_status_enum` 같은 새 타입을 만들려고 해서 마이그레이션에 불필요한 변경이 생깁니다.

  ```ts
  @Column({ type: 'enum', enum: TaskStatus, enumName: 'TaskStatus', default: TaskStatus.PENDING })
  status: TaskStatus;
  ```

---

## 데이터 · 인프라 정책

아래 정책은 `common/` 모듈과 함께 [`COMMON.md`](COMMON.md)에 정리되어 있습니다.

| 정책 | 위치 |
|---|---|
| DB 스키마 관리 — 마이그레이션만 사용 | [COMMON database](COMMON.md#마이그레이션만-사용) |
| 시간대 — 입력 KST · 내부 UTC · 출력 KST | [COMMON 시간대](COMMON.md#시간대--입력-kst--내부-utc--출력-kst) |
| 페이지네이션 (커서·오프셋) | [COMMON pagination](COMMON.md#pagination) |
| Redis 사용 규칙 | [COMMON redis](COMMON.md#사용-규칙) |
| 푸시 · 메일 | [COMMON fcm](COMMON.md#fcm), [mail](COMMON.md#mail) |

### 스케줄러 · 소켓

- cron 잡은 `@nestjs/schedule`의 `@Cron()`으로 도메인의 `<도메인 단수>.scheduler.ts`에 작성하고, 실제 로직은 Service에 둡니다.
- PM2 cluster 모드에서는 **모든 인스턴스가 같은 cron을 동시에 실행**합니다. 잡 시작 시 Redis 락(`SET key value NX EX ttl`)을 잡은 인스턴스만 실행합니다.
- 소켓 게이트웨이는 도메인의 `<도메인 단수>.gateway.ts`에 둡니다. 인스턴스 간 이벤트 공유를 위해 Redis adapter를 씁니다.

---

## 전역 설정 (main.ts)

- Prefix: `/api/v1`
- 전역 적용: `GlobalExceptionFilter`, `ResponseInterceptor`, `KstInterceptor`, `ValidationPipe({ whitelist, transform, exceptionFactory })` — DTO에 없는 필드는 400 없이 제거 (레거시와 동일), `JwtAuthGuard`
- Swagger: `/docs` (운영 환경은 Basic Auth — `SWAGGER_USER`, `SWAGGER_PASSWORD` 필수)
- 응답 형식·에러 코드: [`CODE_CONVENTION.md`](CODE_CONVENTION.md#4-응답-구조)

