import { HttpException } from '@nestjs/common';
import { ErrorCodeDetail } from './error-code';

/**
 * 상수풀의 예외 코드로 던지는 커스텀 예외.
 * @example throw new CustomException(ErrorCode.FORBIDDEN);
 * @example throw new CustomException(ErrorCode.NOT_FOUND, '게시글이 존재하지 않습니다.');
 */
export class CustomException extends HttpException {
  readonly errorCode: string;

  constructor(detail: ErrorCodeDetail, message?: string) {
    super(message ?? detail.message, detail.status);
    this.errorCode = detail.errorCode;
  }
}
