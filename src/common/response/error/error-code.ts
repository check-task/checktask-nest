import { HttpStatus } from '@nestjs/common';

export interface ErrorCodeDetail {
  status: HttpStatus;
  errorCode: string;
  message: string;
}

/**
 * 에러 응답 상수풀 (4xx·5xx). docs/CODE_CONVENTION.md의 에러 코드 표와 같게 유지한다.
 * - 공통: errorCode를 HttpStatus 이름과 맞춰, 내장 예외로 던져도 같은 코드로 응답되게 한다.
 * - 도메인: custom.error.ts의 상태별 에러에 errorCode로 넘긴다. 필터가 이 표의 message를 detail_error로 응답한다.
 */
export const ERROR_CODE = {
  // ===== 공통 (HttpStatus 이름) =====
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
  PAYLOAD_TOO_LARGE: {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    errorCode: 'PAYLOAD_TOO_LARGE',
    message: '요청 본문이 허용된 크기를 초과함',
  },
  INTERNAL_SERVER_ERROR: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: '서버에 에러 발생',
  },
  NOT_IMPLEMENTED: {
    status: HttpStatus.NOT_IMPLEMENTED,
    errorCode: 'NOT_IMPLEMENTED',
    message: '요청한 URI의 메소드에 대해 서버가 구현하고 있지 않음',
  },

  // ===== 도메인 =====
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'VALIDATION_ERROR',
    message: '입력한 요청값이 스키마 조건에 맞지 않음',
  },
  INVALID_INPUT: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_INPUT',
    message: '요청 데이터 형식이 서버가 요구하는 형식과 일치하지 않음',
  },
  DUPLICATE_NAME: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'DUPLICATE_NAME',
    message: '이미 존재하는 중복된 폴더 이름을 사용하려고 시도함',
  },
  DUPLICATE_COLOR: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'DUPLICATE_COLOR',
    message: '이미 존재하는 중복된 폴더 색상을 사용하려고 시도함',
  },
  MAX_FOLDER_LIMIT: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'MAX_FOLDER_LIMIT',
    message: '생성 가능한 폴더의 최대 제한 개수를 초과함',
  },
  INVALID_DATE: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_DATE',
    message: '요청한 날짜 데이터가 유효한 날짜 형식이 아님',
  },
  INVALID_DEADLINE: {
    status: HttpStatus.BAD_REQUEST,
    errorCode: 'INVALID_DEADLINE',
    message: '세부 과제의 마감일이 부모 과제의 마감일을 초과하여 설정됨',
  },
  TOKEN_NOT_FOUND: {
    status: HttpStatus.UNAUTHORIZED,
    errorCode: 'TOKEN_NOT_FOUND',
    message: '요청 헤더(Header)에 인증 토큰이 존재하지 않음',
  },
  TOKEN_EXPIRED: {
    status: HttpStatus.UNAUTHORIZED,
    errorCode: 'TOKEN_EXPIRED',
    message: '제공된 인증 토큰의 유효 기간이 만료됨',
  },
  INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    errorCode: 'INVALID_CREDENTIALS',
    message: '로그인 시 입력한 이메일 또는 비밀번호가 일치하지 않음',
  },
  FORBIDDEN_TASK: {
    status: HttpStatus.FORBIDDEN,
    errorCode: 'FORBIDDEN_TASK',
    message: '해당 과제가 속한 팀의 팀원이 아니거나, 접근/수정 권한이 없음',
  },
  FORBIDDEN_PERSONAL_TASK: {
    status: HttpStatus.FORBIDDEN,
    errorCode: 'FORBIDDEN_PERSONAL_TASK',
    message: '다른 사용자의 개인 과제에 접근하거나 수정하려고 시도함',
  },
  USER_DELETED: {
    status: HttpStatus.FORBIDDEN,
    errorCode: 'USER_DELETED',
    message: '이미 탈퇴 처리된 사용자가 서비스 리소스에 접근하려고 시도함',
  },
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    errorCode: 'USER_NOT_FOUND',
    message: '요청한 정보를 기반으로 DB에서 해당 사용자를 찾을 수 없음',
  },
  TASK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    errorCode: 'TASK_NOT_FOUND',
    message: '요청한 과제(Task)가 존재하지 않거나 이미 삭제됨',
  },
  SUBTASK_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    errorCode: 'SUBTASK_NOT_FOUND',
    message: '요청한 세부 과제(Subtask)가 존재하지 않거나 이미 삭제됨',
  },
  ALARM_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    errorCode: 'ALARM_NOT_FOUND',
    message: '삭제하거나 읽음 처리하려는 대상 알림(Alarm)이 존재하지 않음',
  },
  EMAIL_SEND_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'EMAIL_SEND_FAILED',
    message:
      '외부 API 연동 문제로 이메일 인증 코드 및 임시 비밀번호 발송에 실패함',
  },
  SIGNUP_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'SIGNUP_FAILED',
    message: 'DB 트랜잭션 오류 등의 서버 문제로 회원가입 처리에 실패함',
  },
  USER_WITHDRAW_FAILED: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    errorCode: 'USER_WITHDRAW_FAILED',
    message: 'DB 트랜잭션 오류 등의 서버 문제로 회원 탈퇴 처리에 실패함',
  },
} as const satisfies Record<string, ErrorCodeDetail>;
