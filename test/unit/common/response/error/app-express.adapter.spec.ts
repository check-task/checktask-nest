import { BadRequestException, HttpException } from '@nestjs/common';
import { AppExpressAdapter } from '../../../../../src/common/response/error/app-express.adapter';
import { BadRequestError } from '../../../../../src/common/response/error/custom.error';
import { ERROR_CODE } from '../../../../../src/common/response/error/error-code';

// body-parser(http-errors)가 던지는 에러 모양을 흉내 낸다
const parserError = (
  ErrorClass: ErrorConstructor,
  type: string,
  status: number,
) => Object.assign(new ErrorClass('parser message'), { type, status });

describe('AppExpressAdapter.mapException', () => {
  const adapter = new AppExpressAdapter();

  it('JSON 파싱 실패는 400 INVALID_INPUT', () => {
    const mapped = adapter.mapException(
      parserError(SyntaxError, 'entity.parse.failed', 400),
    ) as BadRequestError;
    expect(mapped).toBeInstanceOf(BadRequestError);
    expect(mapped.errorCode).toBe('INVALID_INPUT');
  });

  it('본문 크기 초과는 413 (에러 코드 표의 PAYLOAD_TOO_LARGE 문구)', () => {
    const mapped = adapter.mapException(
      parserError(Error, 'entity.too.large', 413),
    ) as HttpException;
    expect(mapped).toBeInstanceOf(HttpException);
    expect(mapped.getStatus()).toBe(413);
    expect(mapped.message).toBe(ERROR_CODE.PAYLOAD_TOO_LARGE.message);
  });

  it('그 외 body-parser 4xx는 원래 상태 코드를 유지한다', () => {
    const mapped = adapter.mapException(
      parserError(Error, 'charset.unsupported', 415),
    ) as HttpException;
    expect(mapped).toBeInstanceOf(HttpException);
    expect(mapped.getStatus()).toBe(415);
  });

  it('body-parser 에러가 아니면 기본 동작을 따른다', () => {
    const error = new Error('boom');
    expect(adapter.mapException(error)).toBe(error);
    // 잘못된 URI 인코딩(URIError)은 기본 어댑터처럼 400
    expect(adapter.mapException(new URIError('bad'))).toBeInstanceOf(
      BadRequestException,
    );
  });
});
