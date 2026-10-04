import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from './error-code';

export interface FailResponse {
  resultType: 'FAIL';
  code: number;
  errorCode: string;
  reason: string;
  data: null;
}

/**
 * 모든 예외를 { resultType: 'FAIL', code, errorCode, reason, data } 형태로 변환한다.
 * HttpException → Unknown(500) 순서로 분기하며, 알 수 없는 에러는 내부 정보를 노출하지 않는다.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;
      // ValidationPipe 에러는 message가 배열로 들어오므로 하나의 문자열로 잇는다
      const reason = Array.isArray(message) ? message.join(', ') : message;
      // CustomException은 상수풀의 errorCode를 가진다
      const errorCode =
        (exception as HttpException & { errorCode?: string }).errorCode ??
        HttpStatus[status] ??
        'ERROR';

      if (status >= 500) this.logger.error(exception.message, exception.stack);
      else this.logger.warn(`${status} ${errorCode} - ${reason}`);

      return res.status(status).json(this.fail(status, errorCode, reason));
    }

    const err = exception as Error;
    this.logger.error(err?.message ?? 'Unknown error', err?.stack);
    const { status, errorCode, message } = ErrorCode.INTERNAL_SERVER_ERROR;
    return res.status(status).json(this.fail(status, errorCode, message));
  }

  private fail(code: number, errorCode: string, reason: string): FailResponse {
    return { resultType: 'FAIL', code, errorCode, reason, data: null };
  }
}
