import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BadRequestError, NotFoundError } from './custom.error';
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

  it('CustomError는 지정한 상태 코드·errorCode·reason으로 응답한다', () => {
    filter.catch(
      new NotFoundError('TASK_NOT_FOUND', '요청한 과제가 존재하지 않습니다.'),
      host,
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      resultType: 'FAIL',
      code: 404,
      errorCode: 'TASK_NOT_FOUND',
      reason: '요청한 과제가 존재하지 않습니다.',
      data: null,
    });
  });

  it('CustomError에 인자를 생략하면 기본 errorCode·reason으로 응답한다', () => {
    filter.catch(new NotFoundError(), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 404,
        errorCode: 'NOT_FOUND',
        reason: '리소스를 찾을 수 없습니다',
      }),
    );
  });

  it('CustomError의 data를 응답에 담는다', () => {
    filter.catch(
      new BadRequestError('INVALID_DEADLINE', '마감일 오류', {
        maxDate: '2026-12-31',
      }),
      host,
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { maxDate: '2026-12-31' } }),
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
