import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BadRequestError,
  CustomError,
  NotFoundError,
} from '../../../../../src/common/response/error/custom.error';
import { ERROR_CODE } from '../../../../../src/common/response/error/error-code';
import { GlobalExceptionFilter } from '../../../../../src/common/response/error/error.filter';

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;

  beforeEach(() => vi.clearAllMocks());

  describe('CustomError', () => {
    it('지정한 reason(토스트 문구)과 표의 상세 설명(detail_error)으로 응답한다', () => {
      filter.catch(
        new NotFoundError('TASK_NOT_FOUND', '과제를 찾을 수 없습니다.'),
        host,
      );
      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({
        resultType: 'FAIL',
        code: 404,
        errorCode: 'TASK_NOT_FOUND',
        reason: '과제를 찾을 수 없습니다.',
        detail_error: ERROR_CODE.TASK_NOT_FOUND.message,
        data: null,
      });
    });

    it('reason을 생략하면 클래스 기본 문구(노션)로 응답한다', () => {
      filter.catch(new NotFoundError('TASK_NOT_FOUND'), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'TASK_NOT_FOUND',
          reason: '리소스를 찾을 수 없습니다',
          detail_error: ERROR_CODE.TASK_NOT_FOUND.message,
        }),
      );
    });

    it('인자를 모두 생략하면 기본 errorCode·reason으로 응답한다', () => {
      filter.catch(new NotFoundError(), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 404,
          errorCode: 'NOT_FOUND',
          reason: '리소스를 찾을 수 없습니다',
          detail_error: ERROR_CODE.NOT_FOUND.message,
        }),
      );
    });

    it('data를 응답에 담는다', () => {
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

    it('표에 없는 errorCode면 reason을 detail_error로 쓴다', () => {
      filter.catch(new CustomError(400, 'LEGACY_CODE', '레거시 문구'), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: '레거시 문구',
          detail_error: '레거시 문구',
        }),
      );
    });
  });

  describe('Nest 내장 예외', () => {
    it.each([
      [
        '없는 경로',
        new NotFoundException('Cannot GET /x'),
        404,
        'NOT_FOUND',
        '리소스를 찾을 수 없습니다',
      ],
      [
        'ParseIntPipe',
        new BadRequestException(
          'Validation failed (numeric string is expected)',
        ),
        400,
        'BAD_REQUEST',
        '잘못된 요청입니다',
      ],
      [
        '인증 실패',
        new UnauthorizedException(),
        401,
        'UNAUTHORIZED',
        '인증에 실패했습니다',
      ],
      [
        '메시지 배열',
        new BadRequestException([
          'a should not be empty',
          'b must be a string',
        ]),
        400,
        'BAD_REQUEST',
        '잘못된 요청입니다',
      ],
      [
        '표에만 있는 상태(409)',
        new HttpException('conflict', 409),
        409,
        'CONFLICT',
        ERROR_CODE.CONFLICT.message,
      ],
      [
        '표에 없는 4xx(415)',
        new HttpException('unsupported charset "KLINGON"', 415),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        '잘못된 요청입니다',
      ],
    ])(
      '%s: 영어 메시지 대신 한국어 기본 문구로 응답한다',
      (_, exception, code, errorCode, reason) => {
        filter.catch(exception, host);
        expect(json).toHaveBeenCalledWith(
          expect.objectContaining({ code, errorCode, reason }),
        );
      },
    );

    it('표에 있는 상태는 detail_error에 표 문구를 넣는다', () => {
      filter.catch(new NotFoundException('Cannot GET /x'), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ detail_error: ERROR_CODE.NOT_FOUND.message }),
      );
    });

    it('한국어 메시지는 그대로 응답한다', () => {
      filter.catch(new ForbiddenException('팀장만 접근할 수 있습니다.'), host);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'FORBIDDEN',
          reason: '팀장만 접근할 수 있습니다.',
        }),
      );
    });
  });

  it('알 수 없는 에러는 500으로 응답하고 내부 메시지를 숨긴다', () => {
    filter.catch(new Error('db password leaked'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      resultType: 'FAIL',
      code: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      reason: '서버 내부 오류가 발생했습니다',
      detail_error: '서버에 에러 발생',
      data: null,
    });
  });
});
