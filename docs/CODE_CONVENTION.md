# Code Convention

폴더 구조·레이어 책임은 [`ARCHITECTURE.md`](ARCHITECTURE.md), 브랜치·커밋 규칙은 [`GITHUB_CONVENTION.md`](GITHUB_CONVENTION.md)를 따릅니다.

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
| 테스트 | `.spec.ts` | `task.service.spec.ts` |

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

- 컨트롤러는 `{ message, data }`만 반환하고, `resultType`은 `ResponseInterceptor`가 붙입니다.
- HTTP 상태 코드는 `@HttpCode(SuccessCode.CREATED.status)`처럼 `SuccessCode` 상수로 지정합니다.

```ts
@Post()
@HttpCode(SuccessCode.CREATED.status)
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
  "code": 404,                    // HTTP 상태 코드와 동일
  "errorCode": "TASK_NOT_FOUND",  // 클라이언트가 분기에 사용하는 값
  "reason": "요청한 과제가 존재하지 않거나 이미 삭제됨",
  "data": null
}
```

- 모든 예외는 `GlobalExceptionFilter`가 위 형식으로 변환합니다.
- `reason`은 항상 문자열입니다. DTO 검증 실패 메시지가 여러 개면 `', '`로 이어 붙입니다.
- 아래 에러는 전역 설정이 자동으로 errorCode를 붙입니다. 직접 던지지 않습니다.
  - DTO 검증 실패 → `VALIDATION_ERROR` (`validation-exception.factory.ts`)
  - 토큰 없음 → `TOKEN_NOT_FOUND`, 토큰 만료 → `TOKEN_EXPIRED`, 그 외 토큰 검증 실패 → `UNAUTHORIZED` (`jwt-auth.guard.ts`)
- 정의되지 않은 예외(500)는 내부 정보를 노출하지 않고 `INTERNAL_SERVER_ERROR`로 응답합니다.
- **클라이언트는 `reason`(문구)이 아니라 `errorCode`로 분기합니다.** 문구는 바뀔 수 있습니다.

## 5. 에러 처리

- 필수값·형식은 컨트롤러(DTO 데코레이터, Pipe)에서, 비즈니스 규칙(날짜 역전, 중복 체크 등)은 서비스에서 검증합니다.
- **try/catch를 쓰지 않습니다.** 예외를 던지면 `GlobalExceptionFilter`가 응답으로 변환합니다.
- 에러는 서비스에서 `src/common/response/error/custom.error.ts`의 **상태별 커스텀 에러**를 던집니다.
- errorCode는 아래 [6. 에러 코드](#6-에러-코드) 표에 있는 값을 사용하고, 상태 코드에 맞는 클래스를 고릅니다. (예: `TASK_NOT_FOUND` → `NotFoundError`)

| 클래스 | 상태 코드 | 기본 errorCode | 받을 수 있는 errorCode |
|---|---|---|---|
| `BadRequestError` | 400 | `BAD_REQUEST` | `error-code.ts`에서 status가 400인 것 |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | status가 401인 것 |
| `ForbiddenError` | 403 | `FORBIDDEN` | status가 403인 것 |
| `NotFoundError` | 404 | `NOT_FOUND` | status가 404인 것 |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | status가 500인 것 |

- errorCode는 `error-code.ts`에 정의된 값만 받습니다. 오타나 상태 불일치(`new NotFoundError('INVALID_DATE')`)는 **컴파일 에러**가 납니다.
- reason을 생략하면 `error-code.ts`의 기본 메시지로 응답합니다.

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

성공 코드는 `success-code.ts`의 `SuccessCode`에 정의되어 있습니다.

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

커스텀 에러를 인자 없이 던지거나, Nest 내장 예외·라우트 미존재·JSON 파싱 실패일 때의 errorCode입니다.

| Status | errorCode | 설명 |
|---|---|---|
| 400 | `BAD_REQUEST` | 요청의 구문이 잘못됨 |
| 401 | `UNAUTHORIZED` | 지정한 리소스에 대한 액세스 권한이 없음 |
| 403 | `FORBIDDEN` | 지정한 리소스에 대한 액세스가 금지됨 |
| 404 | `NOT_FOUND` | 지정한 리소스를 찾을 수 없음 |
| 409 | `CONFLICT` | 서버가 요청을 수행하는 중에 충돌 발생 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 내부 오류 |
| 501 | `NOT_IMPLEMENTED` | 요청한 메서드를 서버가 구현하지 않음 |

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
| 401 | `TOKEN_NOT_FOUND` | 요청 헤더에 인증 토큰이 존재하지 않음 |
| 401 | `TOKEN_EXPIRED` | 제공된 인증 토큰의 유효 기간이 만료됨 |
| 401 | `INVALID_CREDENTIALS` | 로그인 시 입력한 이메일 또는 비밀번호가 일치하지 않음 |
| 403 | `FORBIDDEN_TASK` | 해당 과제가 속한 팀의 팀원이 아니거나, 접근/수정 권한이 없음 |
| 403 | `FORBIDDEN_PERSONAL_TASK` | 다른 사용자의 개인 과제에 접근하거나 수정하려고 시도함 |
| 403 | `USER_DELETED` | 이미 탈퇴 처리된 사용자가 서비스 리소스에 접근하려고 시도함 |
| 404 | `USER_NOT_FOUND` | 요청한 정보를 기반으로 DB에서 해당 사용자를 찾을 수 없음 |
| 404 | `TASK_NOT_FOUND` | 요청한 과제가 존재하지 않거나 이미 삭제됨 |
| 404 | `SUBTASK_NOT_FOUND` | 요청한 세부 과제가 존재하지 않거나 이미 삭제됨 |
| 404 | `ALARM_NOT_FOUND` | 삭제하거나 읽음 처리하려는 대상 알림이 존재하지 않음 |
| 500 | `EMAIL_SEND_FAILED` | 외부 API 연동 문제로 이메일 인증 코드 및 임시 비밀번호 발송에 실패함 |
| 500 | `SIGNUP_FAILED` | DB 트랜잭션 오류 등의 서버 문제로 회원가입 처리에 실패함 |
| 500 | `USER_WITHDRAW_FAILED` | DB 트랜잭션 오류 등의 서버 문제로 회원 탈퇴 처리에 실패함 |
