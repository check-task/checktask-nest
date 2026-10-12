import {
  addDays,
  addHours,
  endOfKstDay,
  startOfKstDay,
  toKstString,
} from '../../../../src/common/utils/date.util';

describe('date.util', () => {
  it('toKstString은 +09:00 오프셋 문자열로 바꾼다', () => {
    expect(toKstString(new Date('2026-10-20T14:59:00.000Z'))).toBe(
      '2026-10-20T23:59:00.000+09:00',
    );
    expect(toKstString(new Date('2026-12-31T15:00:00.000Z'))).toBe(
      '2027-01-01T00:00:00.000+09:00',
    );
  });

  it('startOfKstDay는 UTC로는 전날이어도 KST 날짜 기준 00:00을 반환한다', () => {
    // KST 2026-10-21 01:00
    const date = new Date('2026-10-20T16:00:00.000Z');
    expect(startOfKstDay(date).toISOString()).toBe('2026-10-20T15:00:00.000Z');
    expect(endOfKstDay(date).toISOString()).toBe('2026-10-21T14:59:59.999Z');
  });

  it('KST 00:00 정각은 그날의 시작이다', () => {
    const midnight = new Date('2026-10-20T15:00:00.000Z');
    expect(startOfKstDay(midnight)).toEqual(midnight);
  });

  it('addDays·addHours는 원본을 바꾸지 않고 새 Date를 반환한다', () => {
    const deadline = new Date('2026-10-20T14:59:00.000Z');
    expect(addHours(deadline, -24).toISOString()).toBe(
      '2026-10-19T14:59:00.000Z',
    );
    expect(addDays(deadline, 1).toISOString()).toBe('2026-10-21T14:59:00.000Z');
    expect(deadline.toISOString()).toBe('2026-10-20T14:59:00.000Z');
  });
});
