import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDetail {
  status: HttpStatus;
  errorCode: string;
  message: string;
}

/**
 * 에러 응답 상수풀 (4xx·5xx).
 * errorCode는 HttpStatus 이름과 동일하게 맞춰, 내장 예외로 던져도 같은 코드로 응답되게 한다.
 */
export const ErrorCode = {
  BAD_REQUEST: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'BAD_REQUEST',
    message: '요청의 구문이 잘못됨',
  },
  UNAUTHORIZED: {
    status: HttpStatus.UNAUTHORIZED,
    errorCode: 'UNAUTHORIZED',
    message: '지정한 리소스에 대한 액세스 권한이 없음',
  },
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    errorCode: 'FORBIDDEN',
    message: '지정한 리소스에 대한 액세스가 금지',
  },
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    errorCode: 'NOT_FOUND',
    message: '지정한 리소스를 찾을 수 없음',
  },
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    errorCode: 'CONFLICT',
    message: '서버가 요청을 수행하는 중에 충돌 발생',
  },
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: '서버 내부 오류가 발생했습니다',
  },
  NOT_IMPLEMENTED: {
    status: HttpStatus.NOT_IMPLEMENTED,
    errorCode: 'NOT_IMPLEMENTED',
    message: '요청한 URI의 메소드에 대해 서버가 구현하고 있지 않음',
  },
} as const satisfies Record<string, ErrorCodeDetail>;
