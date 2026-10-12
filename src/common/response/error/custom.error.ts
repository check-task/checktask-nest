/**
 * 서비스에서 던지는 커스텀 에러. GlobalExceptionFilter가 FAIL 응답으로 변환한다.
 * @example throw new NotFoundError('TASK_NOT_FOUND', '요청한 과제가 존재하지 않습니다.');
 */
export class CustomError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly reason: string,
    public readonly data: unknown = null,
  ) {
    super(reason);
    this.name = this.constructor.name;
  }
}

// 400 Bad Request
export class BadRequestError extends CustomError {
  constructor(
    errorCode: string = 'BAD_REQUEST',
    reason: string = '잘못된 요청입니다',
    data: unknown = null,
  ) {
    super(400, errorCode, reason, data);
  }
}

// 401 Unauthorized
export class UnauthorizedError extends CustomError {
  constructor(
    errorCode: string = 'UNAUTHORIZED',
    reason: string = '인증에 실패했습니다',
    data: unknown = null,
  ) {
    super(401, errorCode, reason, data);
  }
}

// 403 Forbidden
export class ForbiddenError extends CustomError {
  constructor(
    errorCode: string = 'FORBIDDEN',
    reason: string = '접근 권한이 없습니다',
    data: unknown = null,
  ) {
    super(403, errorCode, reason, data);
  }
}

// 404 Not Found
export class NotFoundError extends CustomError {
  constructor(
    errorCode: string = 'NOT_FOUND',
    reason: string = '리소스를 찾을 수 없습니다',
    data: unknown = null,
  ) {
    super(404, errorCode, reason, data);
  }
}

// 500 Internal Server Error
export class InternalServerError extends CustomError {
  constructor(
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    reason: string = '서버 내부 오류가 발생했습니다',
    data: unknown = null,
  ) {
    super(500, errorCode, reason, data);
  }
}
