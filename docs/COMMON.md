# Common

`src/common/`에 있는 공용 모듈의 역할·사용법·규칙입니다. 도메인 코드에서 공용 기능을 쓰거나 `common/`에 무언가를 추가하기 전에 확인합니다.

- 폴더 구조 전체·레이어 책임·common과 도메인의 경계: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- 응답 형식·에러 처리·에러 코드: [`CODE_CONVENTION.md`](CODE_CONVENTION.md#4-응답-구조)

## 구성

```
src/common/
├── auth/                       # 전역 토큰 "검증" (발급은 auth 도메인)
│   ├── guards/                   jwt-auth.guard.ts          (전역 인증 가드, @Public() 예외)
│   ├── strategies/               jwt.strategy.ts            (Access Token 검증)
│   ├── decorators/               current-user.decorator.ts / public.decorator.ts
│   └── jwt-auth.module.ts        (@Global)
├── database/                   data-source.ts / migration.data-source.ts (TypeORM 설정 / 마이그레이션 CLI용)
├── migrations/                 {timestamp}-{이름}.ts  (TypeORM 마이그레이션, 첫 생성 시 폴더가 만들어짐)
├── config/                     cors.config.ts / env.validation.ts (CORS 허용 출처 / 필수 환경 변수 검사)
├── decorators/                 is-offset-date-time.decorator.ts (공용 검증 데코레이터)
├── enums/                      {이름}.enum.ts + index.ts    (여러 도메인 공용 enum)
├── pagination/                 pagination.dto.ts           (커서·오프셋 공용 query DTO + 응답 변환 함수)
├── utils/                      date.util.ts 등 순수 함수
├── redis/                      redis.module.ts / redis.service.ts   (@Global)
├── s3/                         s3.module.ts / s3.service.ts         (@Global)
├── fcm/                        fcm.module.ts / fcm.service.ts (@Global, 푸시 발송 클라이언트)
├── mail/                       mail.module.ts / mail.service.ts (@Global, 메일 발송 클라이언트)
└── response/
    ├── success/                  response.interceptor.ts / success-code.ts / kst.interceptor.ts
    └── error/                    error.filter.ts / error-code.ts / custom.error.ts / validation-exception.factory.ts / app-express.adapter.ts
```

| 모듈 | 등록 방식 | 도메인에서 쓰는 것 |
|---|---|---|
| `auth` | `JwtAuthModule`(@Global) + `main.ts` 전역 가드 | `@CurrentUser()`, `@Public()` |
| `config` | `main.ts` (`app.enableCors(CORS_OPTIONS)`), `app.module.ts` (`ConfigModule.forRoot({ validate: validateEnv })`) | (직접 쓰지 않음) |
| `database` | `app.module.ts`의 `TypeOrmModule.forRootAsync` | (직접 쓰지 않음) |
| `decorators` | - | `@IsOffsetDateTime()` (날짜 요청 필드) |
| `enums` | - | `import { Provider } from '../common/enums'` |
| `pagination` | - | `CursorPaginationQueryDto`, `OffsetPaginationQueryDto`, `toCursorPage`, `toOffsetPage` |
| `utils` | - | `date.util.ts`의 KST 날짜 함수 |
| `response` | `main.ts` 전역 필터·인터셉터·파이프 | 커스텀 에러 클래스, `SUCCESS_CODE` |
| `redis` / `s3` / `fcm` / `mail` | `app.module.ts`에 등록된 @Global 모듈 | 생성자 주입 (`RedisService` 등) |

@Global 모듈의 도메인 Module 등록 규칙은 [ARCHITECTURE Module](ARCHITECTURE.md#module)을 따릅니다.

### 작성 규칙

- **폴더명**: 종류별 폴더는 복수형(`guards/`, `strategies/`, `decorators/`, `enums/`, `migrations/`, `utils/`), 기능 이름 폴더(`config/`, `redis/`, `s3/`, `response/`, `pagination/`)는 그대로 둡니다.
- **외부 서비스 클라이언트**: `<이름>/<이름>.module.ts`(@Global, `exports`로 서비스 공개) + `<이름>.service.ts`로 만들고 `app.module.ts`의 `imports`에 등록합니다. 서비스는 `OnModuleDestroy`를 구현해 **종료 시 연결을 정리**합니다. (Redis `quit()`, S3 `destroy()`, FCM `deleteApp()`, Mail `close()`)
- **환경 변수**는 `ConfigService`로 읽습니다. 없으면 서버가 뜨면 안 되는 값은 `config/env.validation.ts`에 필수로 선언합니다. (`getOrThrow`는 빈 문자열을 막지 못하므로 필수 여부는 env.validation이 판단) 새 변수는 env.validation·`.env.example`·아래 [환경 변수](#환경-변수) 표에 함께 추가합니다.

---

## auth

Access Token **검증**만 담당합니다. 발급(로그인·재발급)은 `auth` 도메인이 합니다.

```
요청 → JwtAuthGuard (@Public()이면 통과) → JwtStrategy (서명·만료 확인 → validate) → request.user = { id }
```

| 구성 | 역할 |
|---|---|
| `JwtAuthGuard` | `main.ts`에서 전역 등록. `@Public()`이 붙은 핸들러·클래스는 검사하지 않습니다. 실패 원인별로 errorCode를 나눠 던집니다. ([CODE_CONVENTION 실패 응답](CODE_CONVENTION.md#실패) 참고) |
| `JwtStrategy` | `Authorization: Bearer <token>`을 `JWT_SECRET`으로 검증하고, payload의 `id`가 정수가 아니면 `UNAUTHORIZED`를 던집니다. |
| `@CurrentUser()` | `request.user`(`UserPayload = { id: number }`)를 꺼냅니다. |
| `@Public()` | 인증 없이 열어둘 라우트에 붙입니다. |

- **`AccessTokenPayload`** (`jwt.strategy.ts`): `{ id: number, provider: Provider | null, providerId: string | null }`. 레거시(`checktask-back`)와 같은 형태라 기존 토큰도 그대로 검증되며, `auth` 도메인에서 토큰을 발급할 때도 이 타입을 씁니다. 소셜 로그인이 아니면 `provider`·`providerId`는 `null`입니다.
- 컨트롤러에서 쓰는 규칙은 [ARCHITECTURE Controller](ARCHITECTURE.md#controller)를 따릅니다.

---

## config

### cors.config.ts

레거시(`checktask-back`)와 같은 허용 출처·메서드로 CORS를 설정합니다. (`credentials: true`)

| 허용 출처 |
|---|
| `http://localhost:3000`, `http://localhost:8000` |
| `https://checktask.kr`, `https://www.checktask.kr`, `https://dev.checktask.kr`, `https://api.checktask.kr` |

- 목록에 없는 출처는 CORS 헤더를 받지 못합니다. 새 도메인·로컬 포트가 필요하면 `ALLOWED_ORIGINS`에 추가합니다.
- 모바일 앱(React Native)은 브라우저가 아니라 CORS 영향을 받지 않습니다.

### env.validation.ts

서버 시작 시 환경 변수를 검사합니다. **필수 값이 없거나 빈 문자열이면 서버가 뜨지 않고**, 문제가 있는 변수를 한 번에 모두 출력합니다.

```
Error: 환경 변수가 없거나 올바르지 않습니다. .env를 확인하세요.
- JWT_SECRET
- EMAIL_USER
```

- 필수 여부·형식은 아래 [환경 변수](#환경-변수) 표를 따릅니다. 포트는 1~65535 정수, `NODE_ENV`는 `development`·`production`·`test`만 허용합니다.
- 마이그레이션 CLI(`migration.data-source.ts`)는 이 검사를 거치지 않습니다. (DB 변수만 사용)

---

## database

| 파일 | 역할 |
|---|---|
| `data-source.ts` | `buildDataSourceOptions(env)` — 앱과 마이그레이션 CLI가 함께 쓰는 TypeORM(PostgreSQL) 설정. `dataSourceOptions(config)`는 앱(`ConfigService`)용 래퍼 |
| `migration.data-source.ts` | 마이그레이션 CLI 전용 `DataSource`. `dist`에서 실행됩니다. |

- **SSL**: `NODE_ENV=production`이면 SSL로 접속하고, 로컬은 SSL 없이 접속합니다. `DB_SSL_CA`에 RDS 인증서 번들(`global-bundle.pem`) 경로를 주면 서버 인증서까지 검증하고, 비우면 암호화만 합니다.
- 엔티티는 `src/**/*.entity.ts` glob으로 자동 등록됩니다. (`TypeOrmModule.forFeature`는 도메인 Module에서 따로 등록)
- 시간대 관련 설정은 아래 [시간대](#시간대--입력-kst--내부-utc--출력-kst)를 참고합니다.

### 마이그레이션만 사용

- **모든 환경에서 `synchronize: false`** 입니다. 엔티티를 고쳐도 DB는 자동으로 바뀌지 않습니다.
- 스키마 변경은 `src/common/migrations/`의 TypeORM 마이그레이션 파일로만 합니다.
- 마이그레이션은 생성 후 **SQL을 직접 읽고 검토**합니다. 기존 테이블의 DROP·컬럼 타입 변경이 들어 있으면 의도한 것인지 확인합니다.
- 첫 마이그레이션은 기존 DB를 기준선(baseline)으로 삼습니다. 엔티티가 기존 스키마와 정확히 맞으면 generate 결과가 비어 있어야 정상입니다.
- 배포 시 `npm run build` → `npm run migration:run` → 서버 재시작 순서로 실행합니다.

| 명령 | 동작 |
|---|---|
| `npm run migration:generate --name=AddTaskTable` | 빌드 후 엔티티와 DB 차이로 마이그레이션 생성 |
| `npm run migration:create --name=SeedTerms` | 빈 마이그레이션 파일 생성 (직접 SQL 작성) |
| `npm run migration:run` | 아직 실행하지 않은 마이그레이션 적용 (`dist` 기준, 빌드 후 실행) |
| `npm run migration:revert` | 마지막 마이그레이션 1개 되돌리기 |

- CLI는 `.env`가 있으면 읽고, 없으면(운영) 이미 주입된 환경 변수를 씁니다.

---

## enums

- 한 도메인에서만 쓰면 도메인 폴더에, 여러 도메인이 쓰면 `common/enums/`에 두고 `index.ts`에서 re-export 합니다.
- 파일명은 `{이름}.enum.ts`, 값은 **문자열 enum**입니다. (DB·응답에 그대로 노출되므로 순서에 의존하는 숫자 enum은 쓰지 않음)
- enum 파일은 다른 파일을 import하지 않습니다. (순환 참조 방지)
- 엔티티 컬럼은 `enumName`을 지정합니다. ([ARCHITECTURE Entity](ARCHITECTURE.md#entity) 참고) DTO는 `@IsEnum(X)` + `@ApiProperty({ enum: X })`로 검증합니다.

| enum | 값 | 용도 |
|---|---|---|
| `Provider` | `KAKAO`, `APPLE` | 소셜 로그인 제공자 (DB `Provider` enum과 동일) |

---

## pagination

커서·오프셋 두 가지를 규격화하고, API 성격에 따라 고릅니다.

| | 커서 | 오프셋 |
|---|---|---|
| 언제 | 무한 스크롤, 알림처럼 계속 쌓이는 목록 | 페이지 번호 UI, 전체 개수가 필요한 목록 |
| 요청 query | `?cursor=&limit=` | `?page=&size=` (page는 1부터) |
| 응답 data | `{ [목록 키]: [...], meta: { hasNextPage, cursor } }` | `{ [목록 키]: [...], meta: { hasNextPage, page, size, totalCount } }` |
| 요청 DTO | `CursorPaginationQueryDto` | `OffsetPaginationQueryDto` (`skip` getter 제공) |
| 응답 함수 | `toCursorPage(rows, limit, key, getCursor?)` | `toOffsetPage(items, totalCount, query, key)` |

- **응답 형태는 레거시와 같습니다.** 목록 키는 레거시 응답 키를 그대로 씁니다. (예: 알림 목록 `alarmList`)
- 커서는 정렬 기준 컬럼(기본 PK `id`)의 마지막 값입니다. `limit + 1`개를 조회해 `hasNextPage`를 판단합니다. 커서로 쓸 값이 `id`가 아니면(예: DTO의 `alarmId`) `getCursor`를 넘깁니다.
- `limit`·`size`는 기본 10(`DEFAULT_PAGE_SIZE`), 최대 100(`MAX_PAGE_SIZE`)입니다. 상한 없이 받지 않습니다.
- 목록 API별 query DTO는 공용 DTO를 상속해 필터 필드를 추가합니다.

```ts
// 커서: limit + 1개 조회 → toCursorPage가 hasNextPage·cursor 계산
const rows = await this.alarmRepository.find({
  where: { userId, ...(query.cursor && { id: LessThan(query.cursor) }) },
  order: { id: 'DESC' },
  take: query.limit + 1,
});
return toCursorPage(rows.map(AlarmResponseDto.from), query.limit, 'alarmList', (row) => row.alarmId);
// → { alarmList: [...], meta: { hasNextPage: true, cursor: 120 } }

// 오프셋
const [items, totalCount] = await this.taskRepository.findAndCount({ skip: query.skip, take: query.size });
return toOffsetPage(items.map(TaskResponseDto.from), totalCount, query, 'taskList');
// → { taskList: [...], meta: { hasNextPage: true, page: 1, size: 10, totalCount: 32 } }
```

---

## response

응답 형식과 에러를 던지는 방법은 [CODE_CONVENTION 4~6장](CODE_CONVENTION.md#4-응답-구조)에 있습니다. 여기서는 각 파일의 동작만 정리합니다.

| 파일 | 동작 |
|---|---|
| `success/response.interceptor.ts` | 컨트롤러 반환값 `{ message, data }`를 `{ resultType: 'SUCCESS', message, data }`로 감쌉니다. **`message`가 문자열이고 `message`·`data` 외의 키가 없을 때만** 이 형태로 봅니다. 그 외 반환값(엔티티 등)은 `SUCCESS_CODE.OK.message`로 감싸고 전체를 `data`에 넣습니다. 이미 `resultType`이 있는 값과 `StreamableFile`(파일 다운로드)은 감싸지 않습니다. |
| `success/kst.interceptor.ts` | 응답 안의 모든 `Date`를 재귀적으로 KST 문자열로 바꿉니다. (Response DTO 클래스 인스턴스 포함) 원본 객체는 수정하지 않고, Invalid Date는 `null`로 응답합니다. `StreamableFile`·스트림·`Buffer`·`Map`·`Set`은 그대로 둡니다. |
| `success/success-code.ts` | 2xx·3xx 상수풀 (`@HttpCode(SUCCESS_CODE.CREATED.status)`) |
| `error/error.filter.ts` | `GlobalExceptionFilter`. `CustomError` → `HttpException` → 그 외(500) 순서로 분기해 FAIL 응답을 만듭니다. 모든 실패 응답에 errorCode에 해당하는 에러 코드 표의 상세 설명을 `detail_error`로 넣습니다. Nest 내장 예외는 `HttpStatus` 이름을 errorCode로 쓰고, **영어 메시지는 상태 코드에 맞는 한국어 기본 문구로 바꿔** 응답합니다. (커스텀 에러 클래스 기본 문구 → 에러 코드 표 문구 → 4xx `잘못된 요청입니다`·5xx `서버 내부 오류가 발생했습니다` 순) 원래 메시지는 로그에 남기며, 5xx는 `error`, 4xx는 `warn`입니다. |
| `error/custom.error.ts` | `CustomError`와 상태별 클래스(`BadRequestError` 등). 노션 컨벤션의 코드와 동일합니다. |
| `error/error-code.ts` | 4xx·5xx errorCode 상수풀. CODE_CONVENTION의 에러 코드 표와 같게 유지합니다. |
| `error/app-express.adapter.ts` | `AppExpressAdapter`. 요청 본문 파싱(body-parser) 에러를 바꿉니다. JSON 파싱 실패 → `400 INVALID_INPUT`, 크기 초과(기본 100KB) → `413 PAYLOAD_TOO_LARGE`, 그 외 4xx(지원하지 않는 charset 415 등) → 원래 상태 코드 유지. (기본 어댑터는 JSON 파싱 실패를 파서 원문 메시지의 `BAD_REQUEST`로, 크기 초과를 500으로 응답) `main.ts`의 `NestFactory.create(AppModule, new AppExpressAdapter())`로 등록합니다. |
| `error/validation-exception.factory.ts` | `ValidationPipe`의 검증 실패를 `BadRequestError('VALIDATION_ERROR')`로 바꿉니다. reason은 표의 `VALIDATION_ERROR` 문구로 두고, 필드별 메시지는 `data: [{ field, message }]`에 담습니다. class-validator 영어 기본 메시지는 제약별 한국어 문구로 바꾸고(표에 없는 제약은 `{필드}의 값이 올바르지 않습니다.`), 중첩 DTO는 `subTasks.0.title`처럼 경로를 붙입니다. `message` 옵션으로 쓴 한국어 문구는 그대로 씁니다. |

인터셉터 등록 순서는 `new ResponseInterceptor(), new KstInterceptor()`입니다. 응답은 등록 역순으로 처리되므로 KST로 변환한 뒤 SUCCESS로 감쌉니다.

---

## 시간대 — 입력 KST · 내부 UTC · 출력 KST

| 구간 | 기준 | 형식 |
|---|---|---|
| 프론트 → 백엔드 (요청) | KST | ISO 8601 + 오프셋 필수: `2026-10-20T23:59:00+09:00` |
| 백엔드 내부 · DB | UTC | JS `Date`, DB `timestamp` |
| 백엔드 → 프론트 (응답) | KST | `2026-10-20T23:59:00.000+09:00` |

- **요청**: 날짜 필드는 DTO에서 `@IsOffsetDateTime()`(`decorators/is-offset-date-time.decorator.ts`)으로 받습니다. 오프셋(`+09:00` 또는 `Z`)이 있는 문자열만 통과하고, `Date`로 변환되는 순간 UTC 시각이 됩니다.
  - **오프셋 없는 문자열(`2026-10-20T23:59:59`)·날짜만(`2026-10-20`)·없는 날짜(`2026-02-30`)는 `400 VALIDATION_ERROR`** 입니다. 서버 시간대에 따라 의미가 달라지기 때문입니다.
  - `@IsISO8601()` + `@Type(() => Date)` 조합은 쓰지 않습니다. `transform: true`라 `Date`로 먼저 변환된 뒤 검증되어 올바른 값도 항상 실패합니다.
  - 생략 가능한 필드는 `@IsOptional()`과 함께 씁니다. Swagger는 `@ApiProperty({ type: String, format: 'date-time', example: '2026-10-20T23:59:00+09:00' })`로 적습니다.
  - ⚠️ 레거시 웹 프론트는 오프셋 없는 KST 시각을 보내고(`T23:59:59`), 과제 생성 화면은 KST 시각에 `Z`를 붙여 보냅니다(`CreateAssignmentForm.tsx`). 이관한 API를 연결하기 전에 프론트가 `+09:00`을 붙여 보내도록 수정해야 합니다.
- **내부**: Service·Repository에서는 UTC `Date`만 다룹니다. `Date.now() + 9시간` 같은 수동 보정은 하지 않습니다.
- **"오늘", "마감 N일 전" 같은 날짜 경계**는 KST 기준으로 계산해야 하므로 `utils/date.util.ts` 한 곳에서만 처리합니다.
- **응답**: `KstInterceptor`가 `+09:00` 오프셋 문자열로 바꿉니다. Date에 9시간을 더하는 방식은 쓰지 않습니다. (끝에 `Z`가 붙어 실제 시각과 달라짐)
- **DB 연결**: 기존 시간 컬럼은 `timestamp`(time zone 없음)입니다. `data-source.ts`에서 아래 두 가지를 고정해 서버·DB 시간대 설정과 무관하게 UTC로 저장됩니다.
  - pg 드라이버가 `timestamp`를 UTC로 읽고 쓰게 설정 (기본값은 Node 프로세스 로컬 시간대)
  - DB 세션 시간대 `timezone=UTC` (`DEFAULT CURRENT_TIMESTAMP`·`now()`가 DB 서버 시간대를 따르지 않게)

### utils/date.util.ts

입력·반환하는 `Date`는 모두 UTC 시각입니다.

| 함수 | 동작 | 예시 |
|---|---|---|
| `toKstString(date)` | KST 오프셋 문자열로 변환 | `2026-10-20T14:59:00.000Z` → `'2026-10-20T23:59:00.000+09:00'` |
| `startOfKstDay(date)` | KST 기준 그날 00:00 | KST 21일 01:00 → KST 21일 00:00 (`2026-10-20T15:00:00Z`) |
| `endOfKstDay(date)` | KST 기준 그날 23:59:59.999 | |
| `addDays(date, n)` | n일 뒤 (음수면 전) | |
| `addHours(date, n)` | n시간 뒤 (음수면 전) | 마감 N시간 전 알림 시각 = `addHours(deadline, -N)` |

`utils/`에는 의존성 없는 순수 함수만 둡니다.

---

## redis

`RedisService` (ioredis 단일 커넥션)

| 메서드 | 동작 |
|---|---|
| `set(key, value, ttlSeconds?)` | 값 저장. `ttlSeconds`를 주면 해당 초 뒤 만료 |
| `get(key)` | 값 조회 (없으면 `null`) |
| `del(key)` | 키 삭제 |
| `incr(key, ttlSeconds?)` | 1 증가 후 값을 반환. 처음 생성된 키일 때만 TTL을 겁니다. (일일 횟수 제한용) |

### 사용 규칙

- 키 형식: `{용도}:{식별자}` snake_case (예: `refresh_token:{tokenId}`, `pushed_alarm:{alarmId}`)
- 모든 키에 TTL을 겁니다. 영구 저장이 필요한 데이터는 DB에 둡니다.
- `KEYS *`를 쓰지 않습니다. 패턴 조회가 필요하면 `SCAN`을 쓰거나, 조회 가능한 인덱스 키를 따로 둡니다.

---

## s3

`S3Service` — 파일은 서버를 거치지 않고 **Presigned URL**로 클라이언트가 직접 올리고 받습니다. 버킷은 비공개이며 URL 유효 시간은 5분입니다.

| 메서드 | 동작 |
|---|---|
| `getUploadUrl(dir, fileName, contentType)` | `{ key, url }` 반환. key는 `{dir}/{UUID}{확장자}` |
| `getDownloadUrl(key)` | 조회용 Presigned URL 반환 |
| `delete(key)` | 객체 삭제 |

```
1. 클라이언트 → 서버: 업로드 URL 요청 (fileName, contentType)
2. 서버: getUploadUrl() → { key, url } 응답
3. 클라이언트 → S3: url로 PUT (요청 때와 같은 Content-Type 헤더 필수 — 다르면 서명 불일치)
4. 클라이언트 → 서버: key 전달 → DB에는 URL이 아닌 key를 저장
5. 조회 시 서버가 getDownloadUrl(key)로 URL을 발급해 응답
```

- 원본 파일명은 덮어쓰기·경로 조작 방지를 위해 key에 쓰지 않습니다. (확장자만 소문자로 사용)
- `dir`은 용도별 경로입니다. (예: `profile`, `post`)
- `AWS_ACCESS_KEY`·`AWS_SECRET_ACCESS_KEY`가 비어 있으면 SDK 기본 자격 증명(EC2 IAM Role 등)을 씁니다.

---

## fcm

`FcmService.send(token, title, body, data?)` → `Promise<'SENT' | 'INVALID_TOKEN' | 'FAILED'>`

| 결과 | 의미 | 호출한 쪽 처리 |
|---|---|---|
| `SENT` | 발송 성공 | - |
| `INVALID_TOKEN` | 만료·삭제된 디바이스 토큰 | 저장된 토큰을 지웁니다. |
| `FAILED` | 그 외 실패 (FCM 장애 등, 로그 기록됨) | - |

- 실패해도 **예외를 던지지 않습니다.** 푸시 실패로 요청·cron 잡이 실패하지 않게 하기 위함입니다.
- `data`의 값은 FCM 규격상 문자열만 가능합니다. (앱 화면 이동 등에 사용)
- 디바이스 토큰을 어디에 저장·조회할지는 도메인(`users`/`alarms`)이 정합니다. `common/`은 발송만 담당합니다.
- 서비스 계정 키 파일은 저장소에 커밋하지 않고 환경 변수로 넣습니다.

---

## mail

`MailService.send(to, subject, html)` — Gmail SMTP로 HTML 메일을 보냅니다. 발신자는 `"Check-Task" <EMAIL_USER>`입니다.

- 실패하면 `InternalServerError('EMAIL_SEND_FAILED')`를 던집니다. 상세 원인은 로그로만 남깁니다.

---

## 환경 변수

값의 예시는 `.env.example`을 참고합니다. **필수** 값이 없거나 비어 있으면 서버가 뜨지 않습니다. ([env.validation.ts](#envvalidationts))

| 모듈 | 변수 | 필수 | 비고 |
|---|---|---|---|
| 서버 | `NODE_ENV` | | `development`(기본) · `production` · `test` |
| 서버 | `PORT` | | 기본 8000 |
| database | `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | ✅ | |
| database | `DB_PORT` | | 기본 5432 |
| database | `DB_SSL_CA` | | 운영에서만 사용. RDS 인증서 번들 경로 (비우면 암호화만) |
| redis | `REDIS_HOST` | ✅ | |
| redis | `REDIS_PORT`, `REDIS_PASSWORD` | | 포트 기본 6379, 비밀번호가 없으면 비워 둡니다. |
| s3 | `AWS_REGION`, `AWS_S3_BUCKET` | ✅ | |
| s3 | `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` | | 비우면 SDK 기본 자격 증명(EC2 IAM Role 등) 사용 |
| auth | `JWT_SECRET` | ✅ | Access Token 서명 키 |
| auth | `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | | auth 도메인 구현 시 사용 (아직 코드에서 읽지 않음) |
| fcm | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | ✅ | 개인 키의 줄바꿈은 `\n`으로 적고 따옴표로 감쌉니다. |
| mail | `EMAIL_USER`, `EMAIL_PASSWORD` | ✅ | Gmail 앱 비밀번호 |
| swagger | `SWAGGER_USER`, `SWAGGER_PASSWORD` | 운영만 ✅ | 운영에서 `/docs` Basic Auth 계정 |
