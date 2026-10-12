import { ValidationError } from '@nestjs/common';
import { BadRequestError } from './custom.error';
import { ERROR_CODE } from './error-code';

const HANGUL = /[가-힣]/;

// class-validator 영어 기본 메시지에서 숫자·값 목록 등 제약 값을 꺼낸다
const pick = (message: string, pattern: RegExp) => pattern.exec(message)?.[1];

/**
 * class-validator 제약 이름별 한국어 메시지.
 * 기본 메시지가 영어라 응답 전에 한국어로 바꾼다. 제약 값(최댓값 등)은 영어 메시지에서 꺼낸다.
 */
const KOREAN_MESSAGES: Record<
  string,
  (field: string, message: string) => string
> = {
  isDefined: (f) => `${f}은(는) 필수입니다.`,
  isNotEmpty: (f) => `${f}은(는) 비어 있을 수 없습니다.`,
  isString: (f) => `${f}은(는) 문자열이어야 합니다.`,
  isInt: (f) => `${f}은(는) 정수여야 합니다.`,
  isNumber: (f) => `${f}은(는) 숫자여야 합니다.`,
  isNumberString: (f) => `${f}은(는) 숫자 문자열이어야 합니다.`,
  isBoolean: (f) => `${f}은(는) true 또는 false여야 합니다.`,
  isBooleanString: (f) => `${f}은(는) 'true' 또는 'false'여야 합니다.`,
  isArray: (f) => `${f}은(는) 배열이어야 합니다.`,
  isObject: (f) => `${f}은(는) 객체여야 합니다.`,
  isNotEmptyObject: (f) => `${f}은(는) 비어 있지 않은 객체여야 합니다.`,
  isDate: (f) => `${f}은(는) 날짜여야 합니다.`,
  isIso8601: (f) => `${f}은(는) ISO 8601 날짜 형식이어야 합니다.`,
  isEmail: (f) => `${f}은(는) 올바른 이메일 형식이어야 합니다.`,
  isUrl: (f) => `${f}은(는) 올바른 URL 형식이어야 합니다.`,
  isUuid: (f) => `${f}은(는) UUID 형식이어야 합니다.`,
  isPositive: (f) => `${f}은(는) 양수여야 합니다.`,
  isNegative: (f) => `${f}은(는) 음수여야 합니다.`,
  matches: (f) => `${f}의 형식이 올바르지 않습니다.`,
  isEnum: (f, m) =>
    `${f}은(는) 다음 값 중 하나여야 합니다: ${pick(m, /following values: (.*)$/) ?? ''}`.trim(),
  isIn: (f, m) =>
    `${f}은(는) 다음 값 중 하나여야 합니다: ${pick(m, /following values: (.*)$/) ?? ''}`.trim(),
  min: (f, m) => `${f}은(는) ${pick(m, /less than (\S+)/)} 이상이어야 합니다.`,
  max: (f, m) => `${f}은(는) ${pick(m, /greater than (\S+)/)} 이하여야 합니다.`,
  minLength: (f, m) =>
    `${f}은(는) ${pick(m, /equal to (\d+) characters/)}자 이상이어야 합니다.`,
  maxLength: (f, m) =>
    `${f}은(는) ${pick(m, /equal to (\d+) characters/)}자 이하여야 합니다.`,
  arrayNotEmpty: (f) => `${f}은(는) 비어 있을 수 없습니다.`,
  arrayMinSize: (f, m) =>
    `${f}은(는) 최소 ${pick(m, /at least (\d+) elements/)}개의 항목이 필요합니다.`,
  arrayMaxSize: (f, m) =>
    `${f}은(는) 최대 ${pick(m, /no more than (\d+) elements/)}개까지 가능합니다.`,
  nestedValidation: (f) => `${f}은(는) 객체 또는 배열이어야 합니다.`,
  whitelistValidation: (f) => `${f}은(는) 허용되지 않는 필드입니다.`,
};

/**
 * 제약 하나의 메시지를 한국어로 만든다.
 * - DTO에서 message 옵션으로 직접 쓴 한국어 문구는 그대로 쓴다.
 * - 표에 없는 제약은 공통 문구로 응답한다. (영어 메시지를 노출하지 않음)
 */
const toKorean = (constraint: string, message: string, field: string) => {
  if (HANGUL.test(message)) return message;
  // @IsXxx({ each: true })는 배열의 각 값 검증 → 'each value in ' 접두어가 붙는다
  const each = message.startsWith('each value in ');
  const target = each ? `${field}의 각 값` : field;
  return (
    KOREAN_MESSAGES[constraint]?.(target, message) ??
    `${target}의 값이 올바르지 않습니다.`
  );
};

// 필드별 검증 실패 내용 (레거시 validate 미들웨어와 같은 형태)
export interface ValidationIssue {
  field: string; // 'title', 'subTasks.0.title' 형태의 경로
  message: string;
}

// 중첩 DTO(@ValidateNested)의 children까지 내려가며 'subTasks.0.title' 형태의 경로로 모은다
const collectIssues = (
  errors: ValidationError[],
  parentPath?: string,
): ValidationIssue[] =>
  errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    return [
      ...Object.entries(error.constraints ?? {}).map(
        ([constraint, message]) => ({
          field,
          message: toKorean(constraint, message, field),
        }),
      ),
      ...collectIssues(error.children ?? [], field),
    ];
  });

/**
 * ValidationPipe의 검증 실패를 VALIDATION_ERROR로 변환한다.
 * reason은 에러 코드 표의 VALIDATION_ERROR 문구, 필드별 한국어 메시지는 data에 담는다.
 * @example new ValidationPipe({ exceptionFactory: validationExceptionFactory })
 * // → { errorCode: 'VALIDATION_ERROR', reason: '입력한 요청값이…', data: [{ field: 'title', message: 'title은(는) 비어 있을 수 없습니다.' }] }
 */
export const validationExceptionFactory = (errors: ValidationError[]) =>
  new BadRequestError(
    'VALIDATION_ERROR',
    ERROR_CODE.VALIDATION_ERROR.message,
    collectIssues(errors),
  );
