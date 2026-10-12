/**
 * KST 기준 날짜 계산은 이 파일에서만 한다.
 * 서버 내부의 Date는 항상 UTC 시각이며, 여기서 반환하는 Date도 UTC 시각이다.
 */

// KST = UTC + 9시간
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Date를 KST 오프셋 문자열로 바꾼다.
 * @example 2026-10-20T14:59:00.000Z → '2026-10-20T23:59:00.000+09:00'
 */
export const toKstString = (date: Date): string =>
  new Date(date.getTime() + KST_OFFSET_MS).toISOString().replace('Z', '+09:00');

/**
 * KST 기준 그날 00:00을 UTC Date로 반환한다.
 * @example 2026-10-20T16:00:00Z(KST 21일 01:00) → 2026-10-20T15:00:00Z(KST 21일 00:00)
 */
export const startOfKstDay = (date: Date): Date => {
  const kst = date.getTime() + KST_OFFSET_MS;
  return new Date(kst - (kst % DAY_MS) - KST_OFFSET_MS);
};

// KST 기준 그날 23:59:59.999를 UTC Date로 반환한다.
export const endOfKstDay = (date: Date): Date =>
  new Date(startOfKstDay(date).getTime() + DAY_MS - 1);

// N일 뒤 (음수면 N일 전)
export const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY_MS);

// N시간 뒤 (음수면 N시간 전) — 예: 마감 N시간 전 알림 시각 = addHours(deadline, -N)
export const addHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() + hours * HOUR_MS);
