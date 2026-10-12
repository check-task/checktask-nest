import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  BadRequestError,
  CustomError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from './custom.error';
import { ERROR_CODE, ErrorCodeDetail } from './error-code';

const HANGUL = /[가-힣]/;

// 상태 코드별 기본 reason = 커스텀 에러 클래스의 기본 문구 (노션 컨벤션)
const DEFAULT_REASON: Record<number, string> = {
  400: new BadRequestError().reason,
  401: new UnauthorizedError().reason,
  403: new ForbiddenError().reason,
  404: new NotFoundError().reason,
  500: new InternalServerError().reason,
};

const findErrorCode = (errorCode: string | undefined) =>
  errorCode
    ? (ERROR_CODE as Record<string, ErrorCodeDetail | undefined>)[errorCode]
    : undefined;

/**
 * Nest 내장 예외(없는 경로 'Cannot GET /x', ParseIntPipe 'Validation failed ...' 등)는 메시지가 영어다.
 * reason에는 상태 코드에 맞는 한국어 기본 문구를 쓴다. (한국어 메시지는 그대로 사용)
 * 기본 문구 순서: 커스텀 에러 클래스 기본 문구 → 에러 코드 표 문구 → 4xx/5xx 공통 문구
 */
const toKoreanReason = (status: number, message: string): string => {
  if (HANGUL.test(message)) return message;
  return (
    DEFAULT_REASON[status] ??
    findErrorCode(HttpStatus[status])?.message ??
    (status >= 500 ? DEFAULT_REASON[500] : DEFAULT_REASON[400])
  );
};

export interface FailResponse {
  resultType: 'FAIL';
  code: number;
  errorCode: string;
  reason: string; // 사용자에게 보여줄 문구 (프론트 토스트에 그대로 노출 — 레거시 문구 유지)
  detail_error: string; // 에러 코드 표(error-code.ts)의 상세 설명
  data: unknown;
}

/**
 * 모든 예외를 { resultType: 'FAIL', code, errorCode, reason, detail_error, data } 형태로 변환한다.
 * CustomError → HttpException → Unknown(500) 순서로 분기하며, 알 수 없는 에러는 내부 정보를 노출하지 않는다.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // 서비스에서 던진 커스텀 에러는 지정한 상태 코드·errorCode·reason·data를 그대로 응답한다
    if (exception instanceof CustomError) {
      const { statusCode, errorCode, reason, data } = exception;

      if (statusCode >= 500) this.logger.error(reason, exception.stack);
      else this.logger.warn(`${statusCode} ${errorCode} - ${reason}`);

      return res
        .status(statusCode)
        .json(this.fail(statusCode, errorCode, reason, data));
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;
      // message가 배열로 들어오는 경우(내장 ValidationPipe 등) 하나의 문자열로 잇는다
      const original = Array.isArray(message) ? message.join(', ') : message;
      const reason = toKoreanReason(status, original);
      // Nest 내장 예외는 HttpStatus 이름을 errorCode로 쓴다
      const errorCode = HttpStatus[status] ?? 'ERROR';

      // 로그에는 원래 메시지를 남긴다 (디버깅용)
      if (status >= 500) this.logger.error(exception.message, exception.stack);
      else this.logger.warn(`${status} ${errorCode} - ${original}`);

      return res.status(status).json(this.fail(status, errorCode, reason));
    }

    const err = exception as Error;
    this.logger.error(err?.message ?? 'Unknown error', err?.stack);
    // 내부 정보를 숨기고 InternalServerError 기본 문구로 응답한다
    const { statusCode, errorCode, reason } = new InternalServerError();
    return res
      .status(statusCode)
      .json(this.fail(statusCode, errorCode, reason));
  }

  private fail(
    code: number,
    errorCode: string,
    reason: string,
    data: unknown = null,
  ): FailResponse {
    // 상수풀에 없는 errorCode(직접 만든 CustomError 등)는 reason을 상세 설명으로 쓴다
    const detailError = findErrorCode(errorCode)?.message ?? reason;
    return {
      resultType: 'FAIL',
      code,
      errorCode,
      reason,
      detail_error: detailError,
      data,
    };
  }
}
