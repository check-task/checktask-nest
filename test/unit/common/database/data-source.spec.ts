import { defaults, types } from 'pg';
import {
  buildDataSourceOptions,
  parseTimestampAsUtc,
} from '../../../../src/common/database/data-source';

describe('data-source (pg 시간 처리)', () => {
  it('timestamp 컬럼 값을 서버 시간대와 관계없이 UTC로 읽는다', () => {
    expect(parseTimestampAsUtc('2026-10-20 14:59:00').toISOString()).toBe(
      '2026-10-20T14:59:00.000Z',
    );
    expect(parseTimestampAsUtc('2026-10-20 14:59:00.123').toISOString()).toBe(
      '2026-10-20T14:59:00.123Z',
    );
  });

  it('pg 드라이버에 UTC 읽기·쓰기 설정이 등록된다', () => {
    expect(types.getTypeParser(types.builtins.TIMESTAMP)).toBe(
      parseTimestampAsUtc,
    );
    expect(defaults.parseInputDatesAsUTC).toBe(true);
  });
});

describe('data-source (SSL)', () => {
  const build = (env: Record<string, string>) =>
    buildDataSourceOptions((key) => env[key]) as { ssl?: unknown };

  it('로컬은 SSL 없이 접속한다', () => {
    expect(build({ NODE_ENV: 'development' }).ssl).toBe(false);
  });

  it('운영은 SSL로 접속한다', () => {
    expect(build({ NODE_ENV: 'production' }).ssl).toEqual({
      rejectUnauthorized: false,
    });
  });
});
