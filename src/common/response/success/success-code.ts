import { HttpStatus } from '@nestjs/common';

export interface SuccessCodeDetail {
  status: HttpStatus;
  message: string;
}

/**
 * 성공·리다이렉트 응답 상수풀 (2xx·3xx).
 * @example
 * @Post()
 * @HttpCode(SuccessCode.CREATED.status)
 * async create() {
 *   return { message: SuccessCode.CREATED.message, data };
 * }
 */
export const SuccessCode = {
  OK: {
    status: HttpStatus.OK,
    message: '서버가 요청을 성공적으로 처리',
  },
  CREATED: {
    status: HttpStatus.CREATED,
    message: '요청이 처리되어서 새로운 리소스가 생성',
  },
  ACCEPTED: {
    status: HttpStatus.ACCEPTED,
    message: '요청은 접수하였지만, 처리가 완료되지 않음',
  },
  MOVED_PERMANENTLY: {
    status: HttpStatus.MOVED_PERMANENTLY,
    message: '지정한 리소스가 새로운 URI로 이동',
  },
  SEE_OTHER: {
    status: HttpStatus.SEE_OTHER,
    message: '다른 위치로 요청',
  },
} as const satisfies Record<string, SuccessCodeDetail>;
