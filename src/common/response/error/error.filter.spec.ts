import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CustomException } from './custom.exception';
import { ErrorCode } from './error-code';
import { GlobalExceptionFilter } from './error.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  beforeEach(() => vi.clearAllMocks());

  it('CustomException은 상수풀의 코드와 메시지로 응답한다', () => {
    filter.catch(new CustomException(ErrorCode.CONFLICT), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      resultType: 'FAIL',
      code: 409,
      errorCode: 'CONFLICT',
      reason: '서버가 요청을 수행하는 중에 충돌 발생',
      data: null,
    });
  });

  it('CustomException에 메시지를 넘기면 기본 메시지를 덮어쓴다', () => {
    filter.catch(
      new CustomException(ErrorCode.NOT_FOUND, '게시글이 없습니다.'),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'NOT_FOUND',
        reason: '게시글이 없습니다.',
      }),
    );
  });

  it('내장 예외도 상수풀과 같은 errorCode로 응답한다', () => {
    filter.catch(new NotFoundException('없음'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 404,
        errorCode: ErrorCode.NOT_FOUND.errorCode,
      }),
    );
  });

  it('알 수 없는 에러는 500으로 응답하고 내부 메시지를 숨긴다', () => {
    filter.catch(new Error('db password leaked'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'INTERNAL_SERVER_ERROR',
        reason: '서버 내부 오류가 발생했습니다',
      }),
    );
  });

  it('검증 에러의 메시지 배열은 쉼표로 이어 하나의 reason으로 응답한다', () => {
    filter.catch(
      new BadRequestException([
        'name should not be empty',
        'url must be a URL address',
      ]),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'BAD_REQUEST',
        reason: 'name should not be empty, url must be a URL address',
      }),
    );
  });
});
