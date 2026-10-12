import { HttpException } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { BadRequestError } from './custom.error';
import { ERROR_CODE } from './error-code';

// body-parser가 던지는 에러 (http-errors 객체)
interface BodyParserError extends Error {
  type?: string;
  status?: number;
}

/**
 * 요청 파싱 단계(body-parser)의 에러를 GlobalExceptionFilter가 받기 전에 커스텀 에러로 바꾼다.
 * - JSON 파싱 실패 → 400 INVALID_INPUT (기본 어댑터는 파서 원문 메시지의 BAD_REQUEST)
 * - 본문 크기 초과 → 413 PAYLOAD_TOO_LARGE (기본 어댑터를 거치면 500으로 응답됨)
 * - 그 외 body-parser 4xx (지원하지 않는 charset 415 등) → 원래 상태 코드 유지
 */
export class AppExpressAdapter extends ExpressAdapter {
  mapException(error: unknown): unknown {
    if (!(error instanceof Error)) return super.mapException(error);
    const { type, status } = error as BodyParserError;

    if (type === 'entity.parse.failed') {
      return new BadRequestError(
        'INVALID_INPUT',
        '요청 본문이 올바른 JSON 형식이 아닙니다.',
      );
    }
    if (type === 'entity.too.large') {
      const { message, status } = ERROR_CODE.PAYLOAD_TOO_LARGE;
      return new HttpException(message, status);
    }
    if (type && status && status >= 400 && status < 500) {
      return new HttpException(error.message, status);
    }
    return super.mapException(error);
  }
}
