# Code Convention

폴더 구조·레이어 책임은 [`ARCHITECTURE.md`](ARCHITECTURE.md), 공용 모듈 사용법은 [`COMMON.md`](COMMON.md), 브랜치·커밋 규칙은 [`GITHUB_CONVENTION.md`](GITHUB_CONVENTION.md)를 따릅니다.

## 1. 코드 작성

- 문자열은 **작은따옴표**(`'`)를 사용합니다.
- 문장 끝에는 **세미콜론**(`;`)을 붙입니다.
- **연산자 사이**와 **콤마 뒤**에는 공백을 넣습니다.
- 가독성을 위해 **하나의 단계는 한 줄**에 적습니다.

  ```ts
  const folder = await this.folderService.getFolder(folderId);
  ```

- **`any` 타입은 사용하지 않습니다.** 타입을 모르면 `unknown`을 쓰고 좁혀서 사용합니다.
- 따옴표·세미콜론·공백은 Prettier(`.prettierrc`)가 맞춰 주므로 커밋 전 `npm run format`, `npm run lint`를 실행합니다.

## 2. 네이밍

| 대상 | 규칙 | 예시 |
|---|---|---|
| 함수·변수 | camelCase | `getTaskDetail`, `userId` |
| 상수 | UPPER_SNAKE_CASE | `MAX_FOLDER_COUNT`, `ALLOWED_COLORS` |
| 클래스 | PascalCase | `TaskController`, `TaskService`, `CreateTaskDto` |
| 도메인 폴더 | 복수형 kebab-case | `tasks/`, `folders/`, `alarms/`, `references/` |
| 파일 | `<도메인명 단수>.<역할>.ts` (kebab-case) | `task.service.ts` |
| 컨트롤러·서비스 메서드 | 동사 + 명사 (HTTP 메서드명과 구분) | `getTask`, `createTask` |

### 파일 역할 접미사

| 역할 | 접미사 | 예시 |
|---|---|---|
| 컨트롤러 | `.controller.ts` | `task.controller.ts` |
| 서비스 | `.service.ts` | `task.service.ts` |
| 모듈 | `.module.ts` | `task.module.ts` |
| DTO | `.dto.ts` | `task.dto.ts` |
| 엔티티 | `.entity.ts` | `task.entity.ts` |
| 인터페이스 | `.interface.ts` | `task.interface.ts` |
| enum | `.enum.ts` | `task-status.enum.ts` |
| 단위 테스트 | `.spec.ts` | `task.service.spec.ts` |

## 3. 주석

- 주석은 설명하려는 구문에 맞춰 **들여쓰기**합니다.
- 메서드에는 JSDoc(역할, `@throws`), 로직에는 한국어 인라인 주석을 씁니다. 자명한 코드에는 생략합니다.

```ts
/**
 * 과제 상세 조회
 * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
 */
async getTaskDetail(taskId: number) {
  // 세부 과제까지 한 번에 조회 (N+1 방지)
  const task = await this.taskRepository.findOne({ where: { id: taskId }, relations: ['subtasks'] });
}
```

## 4. 응답 구조

모든 API는 성공·실패 모두 아래 형식으로 응답합니다. **컨트롤러에서 직접 `{ resultType: 'SUCCESS', ... }`로 감싸지 않습니다.**

### 성공

```jsonc
// HTTP 200 / 201 ...
{
  "resultType": "SUCCESS",
  "message": "과제 생성 성공",
  "data": { }            // 반환할 값이 없으면 null
}
```

- 컨트롤러는 **항상 `{ message, data }` 객체를 반환**하고, `resultType`은 `ResponseInterceptor`가 붙입니다.
  - 엔티티·DTO를 그대로 반환하지 않고 `data`에 담습니다. (`return task` ❌ → `return { message: '과제 조회 성공', data: task }` ✅)
  - 컨트롤러에서 `{ resultType, ... }`을 직접 만들지 않습니다. 인터셉터가 한 번 더 감싸지는 않지만, 응답 형식은 한 곳(인터셉터)에서만 만듭니다.
  - `{ message, data }` 객체에는 다른 키를 추가하지 않습니다. 다른 키가 있으면 인터셉터가 envelope가 아닌 data로 판단합니다.

#### 성공 상태 코드 (200 / 201)

Nest는 `POST`를 기본 **201**, 나머지를 **200**으로 응답합니다. 레거시는 모든 성공 응답이 **200**이었으므로 아래처럼 지정합니다.

| API | 상태 코드 | 지정 방법 |
|---|---|---|
| 레거시에서 이관한 `POST` | 200 (레거시 유지) | `@HttpCode(SUCCESS_CODE.OK.status)` **필수** |
| 새로 만드는 리소스 생성 `POST` | 201 | `@HttpCode(SUCCESS_CODE.CREATED.status)` |
| `GET`·`PATCH`·`PUT`·`DELETE` | 200 | 생략 가능 |

```ts
@Post()
@HttpCode(SUCCESS_CODE.OK.status) // 레거시 이관 API: 200 유지
async createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: UserPayload) {
  const data = await this.taskService.createTask(dto, user.id);
  return { message: '과제 생성 성공', data };
}
```

### 실패

```jsonc
// HTTP 404
{
  "resultType": "FAIL",
  "code": 404,                                       // HTTP 상태 코드와 동일
  "errorCode": "TASK_NOT_FOUND",                     // 클라이언트가 분기에 사용하는 값
  "reason": "과제를 찾을 수 없습니다.",                   // 사용자에게 보여줄 문구 (프론트 토스트에 그대로 노출)
  "detail_error": "요청한 과제(Task)가 존재하지 않거나 이미 삭제됨", // 에러 코드 표의 상세 설명
  "data": null
}

// HTTP 400 — DTO 검증 실패
{
  "resultType": "FAIL",
  "code": 400,
  "errorCode": "VALIDATION_ERROR",
  "reason": "입력한 요청값이 스키마 조건에 맞지 않음",
  "detail_error": "입력한 요청값이 스키마 조건에 맞지 않음",
  "data": [                                          // 필드별 상세 (레거시와 같은 형태)
    { "field": "title", "message": "title은(는) 비어 있을 수 없습니다." },
    { "field": "subTasks.0.title", "message": "subTasks.0.title은(는) 10자 이하여야 합니다." }
  ]
}
```

- 모든 예외는 `GlobalExceptionFilter`가 위 형식으로 변환합니다.

| 필드 | 값 | 정하는 곳 |
|---|---|---|
| `reason` | **사용자에게 보여줄 문구.** 프론트가 토스트에 그대로 띄우므로 레거시 문구를 유지합니다. | 커스텀 에러를 던질 때 두 번째 인자로 넘깁니다. 생략하면 에러 코드 표의 문구 |
| `detail_error` | **에러 코드 표(`error-code.ts`)의 상세 설명.** errorCode마다 하나로 고정됩니다. | 필터가 errorCode로 자동으로 채웁니다. (표에 없는 errorCode면 reason과 같음) |

- `reason`·`detail_error`는 항상 **한국어 문자열**입니다. 영어 메시지는 응답에 내보내지 않습니다. (원래 메시지는 서버 로그에만 남습니다)
  - DTO 검증 실패: reason은 표의 `VALIDATION_ERROR` 문구이고, 필드별 메시지는 `data`의 `{ field, message }` 배열에 담습니다. class-validator 기본 영어 메시지는 한국어로 바꾸고, 데코레이터에 `message`로 직접 쓴 한국어 문구는 그대로 씁니다.
  - Nest 내장 예외(없는 경로, `ParseIntPipe` 등): reason은 상태 코드에 맞는 커스텀 에러 클래스의 기본 문구(예: 404 → `리소스를 찾을 수 없습니다`), detail_error는 에러 코드 표의 문구입니다. 클래스가 없는 상태는 표 문구 → 4xx/5xx 기본 문구 순으로 씁니다.
- 아래 에러는 전역 설정이 자동으로 errorCode를 붙입니다. 직접 던지지 않습니다.
  - DTO 검증 실패 → `VALIDATION_ERROR` (`validation-exception.factory.ts`)
  - 요청 본문 JSON 파싱 실패 → `INVALID_INPUT`, 본문 크기 초과(기본 100KB) → `PAYLOAD_TOO_LARGE` (`app-express.adapter.ts`)
  - 토큰 없음 → `TOKEN_NOT_FOUND`, 토큰 만료 → `TOKEN_EXPIRED`, 그 외 토큰 검증 실패 → `UNAUTHORIZED` (`jwt-auth.guard.ts`)
- 정의되지 않은 예외(500)는 내부 정보를 노출하지 않고 `INTERNAL_SERVER_ERROR`로 응답합니다.
- **클라이언트는 `reason`(문구)이 아니라 `errorCode`로 분기합니다.** 문구는 바뀔 수 있습니다.

## 5. 에러 처리

- 필수값·형식은 컨트롤러(DTO 데코레이터, Pipe)에서, 비즈니스 규칙(날짜 역전, 중복 체크 등)은 서비스에서 검증합니다.
- **try/catch를 쓰지 않습니다.** 예외를 던지면 `GlobalExceptionFilter`가 응답으로 변환합니다.
- **예외: 외부 API 호출(메일·푸시·소셜 로그인 등 서버 밖으로 나가는 요청)은 try/catch로 감쌉니다.** 외부 에러를 그대로 올리지 않고 아래 둘 중 하나로 처리합니다.
  - 실패가 요청 실패여야 하면 → 정의된 커스텀 에러로 바꿔 던집니다. 원인은 로그로만 남깁니다.
    ```ts
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(`메일 발송 실패: ${to}`, (error as Error).stack);
      throw new InternalServerError('EMAIL_SEND_FAILED', '이메일 발송에 실패했습니다.');
    }
    ```
  - 실패해도 본 작업은 성공이어야 하면(푸시 알림 같은 부가 작업) → 예외를 던지지 않고 결과값으로 반환합니다. (예: `FcmService.send()` → `'SENT' | 'INVALID_TOKEN' | 'FAILED'`)
  - try 블록에는 **외부 API 호출만** 넣습니다. DB 작업 등 다른 로직을 함께 감싸지 않습니다.
  - 이미 처리된 `common/` 클라이언트(`MailService`, `FcmService` 등)를 호출할 때는 다시 try/catch로 감싸지 않습니다.
- 에러는 서비스에서 `src/common/response/error/custom.error.ts`의 **상태별 커스텀 에러**를 던집니다.
- errorCode는 아래 [6. 에러 코드](#6-에러-코드) 표에 있는 값을 사용하고, 상태 코드에 맞는 클래스를 고릅니다. (예: `TASK_NOT_FOUND` → `NotFoundError`)

| 클래스 | 상태 코드 | 기본 errorCode | 기본 reason |
|---|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` | 잘못된 요청입니다 |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | 인증에 실패했습니다 |
| `ForbiddenError` | 403 | `FORBIDDEN` | 접근 권한이 없습니다 |
| `NotFoundError` | 404 | `NOT_FOUND` | 리소스를 찾을 수 없습니다 |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | 서버에 에러 발생 |

- 클래스는 노션 컨벤션의 코드와 동일합니다. (`custom.error.ts`)
- errorCode는 문자열이라 오타를 잡아주지 않습니다. **반드시 아래 에러 코드 표(`error-code.ts`)에 있는 값을 쓰고**, 상태 코드에 맞는 클래스를 고릅니다. 표에 없는 errorCode는 `detail_error`가 reason과 같은 값으로 나갑니다.
- reason은 사용자에게 보여줄 문구입니다. 레거시에서 이관하는 API는 **레거시와 같은 문구**를 넘겨 프론트 토스트를 유지합니다. 생략하면 위 표의 기본 reason입니다.

```ts
// new XxxError(errorCode, reason, data)
throw new NotFoundError('TASK_NOT_FOUND', '요청한 과제가 존재하지 않습니다.');
throw new BadRequestError('INVALID_DEADLINE', '세부 과제 마감일이 과제 마감일을 넘습니다.', { maxDate });
throw new ForbiddenError(); // 인자를 생략하면 기본 errorCode·reason
```

- 세 번째 인자 `data`는 실패 응답의 `data`에 그대로 담깁니다. 클라이언트에 추가 정보가 필요할 때만 넘깁니다.
- 위 클래스에 없는 상태 코드(예: 409)가 필요하면 같은 형태로 `custom.error.ts`에 클래스를 추가합니다.

### 에러 코드 추가 절차

1. `src/common/response/error/error-code.ts`에 `{ status, errorCode, message }`를 추가합니다. (추가해야 커스텀 에러에 넘길 수 있습니다)
2. 아래 [6. 에러 코드](#6-에러-코드) 표와 노션 에러 코드 문서도 함께 업데이트합니다.

### HTTP 상태 코드

성공 코드는 `success-code.ts`의 `SUCCESS_CODE`에 정의되어 있습니다.

| 코드 | 상태 텍스트 | 의미 |
|---|---|---|
| 200 | OK | 서버가 요청을 성공적으로 처리 |
| 201 | Created | 요청이 처리되어서 새로운 리소스가 생성 |
| 202 | Accepted | 요청은 접수하였지만, 처리가 완료되지 않음 |
| 301 | Moved Permanently | 지정한 리소스가 새로운 URI로 이동 |
| 303 | See Other | 다른 위치로 요청 |
| 400 | Bad Request | 요청의 구문이 잘못됨 |
| 401 | Unauthorized | 지정한 리소스에 대한 액세스 권한이 없음 |
| 403 | Forbidden | 지정한 리소스에 대한 액세스가 금지 |
| 404 | Not Found | 지정한 리소스를 찾을 수 없음 |
| 409 | Conflict | 서버가 요청을 수행하는 중에 충돌 발생 |
| 413 | Payload Too Large | 요청 본문이 허용된 크기를 초과 |
| 500 | Internal Server Error | 서버에 에러 발생 |
| 501 | Not Implemented | 요청한 URI의 메소드에 대해 서버가 구현하고 있지 않음 |

## 6. 에러 코드

### 네이밍 규칙

- `UPPER_SNAKE_CASE`
- 형식: `{대상}_{상태}` (예: `TASK_NOT_FOUND`) 또는 `{상태}_{대상}` (예: `FORBIDDEN_TASK`, `INVALID_DEADLINE`)

| 키워드 | 의미 | 예시 |
|---|---|---|
| `INVALID_` | 값의 형식·조건이 잘못됨 | `INVALID_DATE` |
| `DUPLICATE_` | 이미 존재하는 값 | `DUPLICATE_NAME` |
| `_NOT_FOUND` | 대상이 없음 | `USER_NOT_FOUND` |
| `FORBIDDEN_` | 권한 없음 | `FORBIDDEN_TASK` |
| `_FAILED` | 서버 처리 실패 | `EMAIL_SEND_FAILED` |

### 공통 (HTTP 상태 기본값)

커스텀 에러를 인자 없이 던지거나, Nest 내장 예외·라우트 미존재일 때의 errorCode입니다. (요청 본문 JSON 파싱 실패는 `INVALID_INPUT`, 크기 초과는 `PAYLOAD_TOO_LARGE`)

| Status | errorCode | 설명 |
|---|---|---|
| 400 | `BAD_REQUEST` | 요청의 구문이 잘못됨 |
| 401 | `UNAUTHORIZED` | 지정한 리소스에 대한 액세스 권한이 없음 |
| 403 | `FORBIDDEN` | 지정한 리소스에 대한 액세스가 금지 |
| 404 | `NOT_FOUND` | 지정한 리소스를 찾을 수 없음 |
| 409 | `CONFLICT` | 서버가 요청을 수행하는 중에 충돌 발생 |
| 413 | `PAYLOAD_TOO_LARGE` | 요청 본문이 허용된 크기를 초과함 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버에 에러 발생 |
| 501 | `NOT_IMPLEMENTED` | 요청한 URI의 메소드에 대해 서버가 구현하고 있지 않음 |

### 도메인

| Status | errorCode | 설명 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 입력한 요청값이 스키마 조건에 맞지 않음 |
| 400 | `INVALID_INPUT` | 요청 데이터 형식이 서버가 요구하는 형식과 일치하지 않음 |
| 400 | `DUPLICATE_NAME` | 이미 존재하는 중복된 폴더 이름을 사용하려고 시도함 |
| 400 | `DUPLICATE_COLOR` | 이미 존재하는 중복된 폴더 색상을 사용하려고 시도함 |
| 400 | `MAX_FOLDER_LIMIT` | 생성 가능한 폴더의 최대 제한 개수를 초과함 |
| 400 | `INVALID_DATE` | 요청한 날짜 데이터가 유효한 날짜 형식이 아님 |
| 400 | `INVALID_DEADLINE` | 세부 과제의 마감일이 부모 과제의 마감일을 초과하여 설정됨 |
| 401 | `TOKEN_NOT_FOUND` | 요청 헤더(Header)에 인증 토큰이 존재하지 않음 |
| 401 | `TOKEN_EXPIRED` | 제공된 인증 토큰의 유효 기간이 만료됨 |
| 401 | `INVALID_CREDENTIALS` | 로그인 시 입력한 이메일 또는 비밀번호가 일치하지 않음 |
| 403 | `FORBIDDEN_TASK` | 해당 과제가 속한 팀의 팀원이 아니거나, 접근/수정 권한이 없음 |
| 403 | `FORBIDDEN_PERSONAL_TASK` | 다른 사용자의 개인 과제에 접근하거나 수정하려고 시도함 |
| 403 | `USER_DELETED` | 이미 탈퇴 처리된 사용자가 서비스 리소스에 접근하려고 시도함 |
| 404 | `USER_NOT_FOUND` | 요청한 정보를 기반으로 DB에서 해당 사용자를 찾을 수 없음 |
| 404 | `TASK_NOT_FOUND` | 요청한 과제(Task)가 존재하지 않거나 이미 삭제됨 |
| 404 | `SUBTASK_NOT_FOUND` | 요청한 세부 과제(Subtask)가 존재하지 않거나 이미 삭제됨 |
| 404 | `ALARM_NOT_FOUND` | 삭제하거나 읽음 처리하려는 대상 알림(Alarm)이 존재하지 않음 |
| 500 | `EMAIL_SEND_FAILED` | 외부 API 연동 문제로 이메일 인증 코드 및 임시 비밀번호 발송에 실패함 |
| 500 | `SIGNUP_FAILED` | DB 트랜잭션 오류 등의 서버 문제로 회원가입 처리에 실패함 |
| 500 | `USER_WITHDRAW_FAILED` | DB 트랜잭션 오류 등의 서버 문제로 회원 탈퇴 처리에 실패함 |

## 7. 테스트

**`src/`에는 실제 코드만 둡니다.** 테스트 코드는 모두 루트의 `test/`에서 관리합니다.

```
test/
├── unit/                            # 단위 테스트 — src/ 구조를 그대로 따라감
│   └── common/
│       └── redis/redis.service.spec.ts   ↔ src/common/redis/redis.service.ts
```

| 종류 | 위치 | 파일명 | 실행 |
|---|---|---|---|
| 단위 | `test/unit/<src 기준 경로>/` | `<대상 파일명>.spec.ts` | `npm run test` |

- 단위 테스트는 **대상 파일과 같은 경로**에 둡니다. `src/tasks/task.service.ts`의 테스트는 `test/unit/tasks/task.service.spec.ts`입니다.
- 대상 코드는 상대 경로로 import합니다. (예: `import { RedisService } from '../../../../src/common/redis/redis.service';`)
- 대상 파일을 옮기거나 이름을 바꾸면 테스트 파일도 같은 커밋에서 함께 옮깁니다.
- `vitest.config.ts`는 `test/unit/**/*.spec.ts`만 실행합니다. 이 위치 밖의 테스트는 실행되지 않습니다.
