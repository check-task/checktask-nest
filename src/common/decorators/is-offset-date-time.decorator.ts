import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  buildMessage,
  isISO8601,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';

// 날짜 + 시각 + 오프셋(Z 또는 ±HH:mm)이 모두 있어야 한다. 예: 2026-10-20T23:59:00+09:00
const OFFSET_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// 오프셋이 있고, 실제로 존재하는 날짜인지(2026-02-30 등 제외) 확인한다
export const isOffsetDateTimeString = (value: unknown): value is string =>
  typeof value === 'string' &&
  OFFSET_DATE_TIME.test(value) &&
  isISO8601(value, { strict: true });

/**
 * 오프셋이 포함된 ISO 8601 날짜 문자열만 받아 Date(UTC 시각)로 변환한다.
 * 오프셋 없는 문자열('2026-10-20T23:59:00')은 서버 시간대에 따라 의미가 달라지므로 VALIDATION_ERROR로 거절한다.
 * `@IsISO8601()` + `@Type(() => Date)` 조합은 변환 후 검증되어 항상 실패하므로 쓰지 않는다.
 * @example
 * @ApiProperty({ type: String, format: 'date-time', example: '2026-10-20T23:59:00+09:00' })
 * @IsOffsetDateTime()
 * deadline: Date;
 */
export const IsOffsetDateTime = (validationOptions?: ValidationOptions) =>
  applyDecorators(
    // 올바른 문자열만 Date로 바꾸고, 나머지는 그대로 두어 아래 검증에서 실패시킨다
    Transform(({ value }: { value: unknown }) =>
      isOffsetDateTimeString(value) ? new Date(value) : value,
    ),
    ValidateBy(
      {
        name: 'isOffsetDateTime',
        validator: {
          validate: (value: unknown) =>
            value instanceof Date && !Number.isNaN(value.getTime()),
          defaultMessage: buildMessage(
            () =>
              '$property은(는) 오프셋을 포함한 ISO 8601 날짜여야 합니다. (예: 2026-10-20T23:59:00+09:00)',
          ),
        },
      },
      validationOptions,
    ),
  );
