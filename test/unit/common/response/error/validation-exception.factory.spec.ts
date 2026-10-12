import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { BadRequestError } from '../../../../../src/common/response/error/custom.error';
import { ERROR_CODE } from '../../../../../src/common/response/error/error-code';
import { validationExceptionFactory } from '../../../../../src/common/response/error/validation-exception.factory';

enum TaskType {
  PERSONAL = 'PERSONAL',
  TEAM = 'TEAM',
}

class SubTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}

class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(10) title: string;
  @IsInt() @Min(1) @Max(6) folderId: number;
  @IsEnum(TaskType) type: TaskType;
  @IsBoolean() isAlarm: boolean;
  @IsEmail() email: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubTaskDto)
  subTasks: SubTaskDto[];
  @IsInt({ each: true }) assigneeIds: number[];
  @IsNotEmpty({ message: '메모는 필수입니다.' }) memo: string;
}

const VALID = {
  title: '과제',
  folderId: 1,
  type: 'TEAM',
  isAlarm: true,
  email: 'a@b.com',
  subTasks: [{ title: '세부' }],
  assigneeIds: [1],
  memo: '메모',
};

// main.ts와 같은 전역 ValidationPipe 설정으로 실제 검증을 돌린다
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: validationExceptionFactory,
});
// 필드별 메시지(data)를 돌려준다. reason은 항상 에러 코드 표의 VALIDATION_ERROR 문구여야 한다
const issuesOf = async (body: object) => {
  const error = await pipe
    .transform(body, { type: 'body', metatype: CreateTaskDto })
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(BadRequestError);
  const { errorCode, reason, data } = error as BadRequestError;
  expect(errorCode).toBe('VALIDATION_ERROR');
  expect(reason).toBe(ERROR_CODE.VALIDATION_ERROR.message);
  return data as { field: string; message: string }[];
};
const messagesOf = async (body: object) =>
  (await issuesOf(body)).map((issue) => issue.message);

describe('validationExceptionFactory', () => {
  it.each([
    ['비어 있음', { title: '' }, 'title은(는) 비어 있을 수 없습니다.'],
    ['문자열 아님', { title: 1 }, 'title은(는) 문자열이어야 합니다.'],
    [
      '최대 길이',
      { title: '열한글자가넘는과제명' + '!' },
      'title은(는) 10자 이하여야 합니다.',
    ],
    ['정수 아님', { folderId: 1.5 }, 'folderId은(는) 정수여야 합니다.'],
    ['최솟값', { folderId: 0 }, 'folderId은(는) 1 이상이어야 합니다.'],
    ['최댓값', { folderId: 7 }, 'folderId은(는) 6 이하여야 합니다.'],
    [
      'enum',
      { type: 'GROUP' },
      'type은(는) 다음 값 중 하나여야 합니다: PERSONAL, TEAM',
    ],
    [
      'boolean',
      { isAlarm: 'yes' },
      'isAlarm은(는) true 또는 false여야 합니다.',
    ],
    [
      '이메일',
      { email: 'not-email' },
      'email은(는) 올바른 이메일 형식이어야 합니다.',
    ],
    [
      '배열 최소 개수',
      { subTasks: [] },
      'subTasks은(는) 최소 1개의 항목이 필요합니다.',
    ],
    [
      '중첩 DTO 경로',
      { subTasks: [{ title: '' }] },
      'subTasks.0.title은(는) 비어 있을 수 없습니다.',
    ],
    [
      'each 옵션',
      { assigneeIds: ['a'] },
      'assigneeIds의 각 값은(는) 정수여야 합니다.',
    ],
    ['DTO에 직접 쓴 한국어 메시지', { memo: '' }, '메모는 필수입니다.'],
  ])('%s → 한국어 메시지', async (_, override, expected) => {
    // 한 필드에 여러 제약이 함께 실패할 수 있어 포함 여부로 확인한다 (예: 숫자 1 → isString·maxLength)
    expect(await messagesOf({ ...VALID, ...override })).toContain(expected);
  });

  it('data에 필드 경로와 한국어 메시지를 담고, 영어는 남지 않는다', async () => {
    const issues = await issuesOf({ ...VALID, subTasks: [{ title: '' }] });
    expect(issues).toEqual([
      {
        field: 'subTasks.0.title',
        message: 'subTasks.0.title은(는) 비어 있을 수 없습니다.',
      },
    ]);
    const all = await messagesOf({});
    expect(all.length).toBeGreaterThan(1);
    expect(all.join(' ')).not.toMatch(/must|should|each value/);
  });

  it('표에 없는 제약은 공통 한국어 문구로 응답한다', () => {
    const error = validationExceptionFactory([
      {
        property: 'code',
        constraints: { isHexColor: 'code must be a hexadecimal color' },
      },
    ]);
    expect(error.data).toEqual([
      { field: 'code', message: 'code의 값이 올바르지 않습니다.' },
    ]);
  });
});
