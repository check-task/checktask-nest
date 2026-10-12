import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsOptional, validateSync } from 'class-validator';
import { IsOffsetDateTime } from '../../../../src/common/decorators/is-offset-date-time.decorator';
import { BadRequestError } from '../../../../src/common/response/error/custom.error';
import { validationExceptionFactory } from '../../../../src/common/response/error/validation-exception.factory';

class TaskDto {
  @IsOffsetDateTime()
  deadline: Date;
}

class OptionalDto {
  @IsOptional()
  @IsOffsetDateTime()
  endDate?: Date;
}

// ValidationPipe({ transform: true })와 같은 순서: 변환 → 검증
const parse = <T extends object>(cls: new () => T, body: object) => {
  const dto = plainToInstance(cls, body);
  return { dto, errors: validateSync(dto) };
};

describe('IsOffsetDateTime', () => {
  it.each([
    ['KST 오프셋', '2026-10-20T23:59:00+09:00', '2026-10-20T14:59:00.000Z'],
    ['UTC(Z)', '2026-10-20T14:59:00Z', '2026-10-20T14:59:00.000Z'],
    [
      '밀리초 포함',
      '2026-10-20T23:59:59.123+09:00',
      '2026-10-20T14:59:59.123Z',
    ],
    ['초 생략', '2026-10-20T23:59+09:00', '2026-10-20T14:59:00.000Z'],
  ])('%s 문자열을 UTC 시각의 Date로 바꾼다', (_, input, utc) => {
    const { dto, errors } = parse(TaskDto, { deadline: input });
    expect(errors).toHaveLength(0);
    expect(dto.deadline).toBeInstanceOf(Date);
    expect(dto.deadline.toISOString()).toBe(utc);
  });

  it.each([
    ['오프셋 없음', '2026-10-20T23:59:59'],
    ['날짜만', '2026-10-20'],
    ['없는 날짜', '2026-02-30T10:00:00+09:00'],
    ['형식 오류', 'tomorrow'],
    ['숫자(타임스탬프)', 1791800000000],
    ['null', null],
  ])('%s은(는) VALIDATION 실패', (_, input) => {
    const { errors } = parse(TaskDto, { deadline: input });
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})[0]).toContain(
      '오프셋을 포함한 ISO 8601 날짜',
    );
  });

  it('필드가 없으면 실패하고, @IsOptional과 함께 쓰면 생략할 수 있다', () => {
    expect(parse(TaskDto, {}).errors).toHaveLength(1);
    expect(parse(OptionalDto, {}).errors).toHaveLength(0);
  });

  describe('전역 ValidationPipe 설정(main.ts)과 함께', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    });
    const run = (body: object) =>
      pipe.transform(body, { type: 'body', metatype: TaskDto });

    it('whitelist에 제거되지 않고 Date로 변환된다', async () => {
      const dto = (await run({
        deadline: '2026-10-20T23:59:00+09:00',
      })) as TaskDto;
      expect(dto.deadline.toISOString()).toBe('2026-10-20T14:59:00.000Z');
    });

    it('오프셋이 없으면 VALIDATION_ERROR를 던진다', async () => {
      const error = await run({ deadline: '2026-10-20T23:59:59' }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(BadRequestError);
      expect((error as BadRequestError).errorCode).toBe('VALIDATION_ERROR');
    });
  });
});
