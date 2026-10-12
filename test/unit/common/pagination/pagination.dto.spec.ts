import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CursorPaginationQueryDto,
  OffsetPaginationQueryDto,
  toCursorPage,
  toOffsetPage,
} from '../../../../src/common/pagination/pagination.dto';

describe('pagination', () => {
  describe('toCursorPage', () => {
    const rows = [{ id: 30 }, { id: 20 }, { id: 10 }];

    it('레거시 형태 { [key]: items, meta: { hasNextPage, cursor } }로 응답한다', () => {
      expect(toCursorPage(rows, 2, 'alarmList')).toEqual({
        alarmList: [{ id: 30 }, { id: 20 }],
        meta: { hasNextPage: true, cursor: 20 },
      });
    });

    it('마지막 페이지면 cursor는 null이다', () => {
      expect(toCursorPage(rows, 3, 'alarmList')).toEqual({
        alarmList: rows,
        meta: { hasNextPage: false, cursor: null },
      });
    });

    it('getCursor로 커서 값을 지정할 수 있다', () => {
      const dtos = [{ alarmId: 3 }, { alarmId: 2 }];
      expect(
        toCursorPage(dtos, 1, 'alarmList', (row) => row.alarmId).meta.cursor,
      ).toBe(3);
    });

    it('빈 결과도 처리한다', () => {
      expect(toCursorPage([], 10, 'alarmList')).toEqual({
        alarmList: [],
        meta: { hasNextPage: false, cursor: null },
      });
    });
  });

  it('toOffsetPage는 같은 meta 형태로 page·size·totalCount를 담는다', () => {
    expect(toOffsetPage([1, 2], 12, { page: 2, size: 2 }, 'taskList')).toEqual({
      taskList: [1, 2],
      meta: { hasNextPage: true, page: 2, size: 2, totalCount: 12 },
    });
    expect(
      toOffsetPage([1, 2], 4, { page: 2, size: 2 }, 'taskList').meta
        .hasNextPage,
    ).toBe(false);
  });

  describe('query DTO', () => {
    it('값이 없으면 기본값을 쓴다', () => {
      const cursor = plainToInstance(CursorPaginationQueryDto, {});
      const offset = plainToInstance(OffsetPaginationQueryDto, {});
      expect(cursor.limit).toBe(10);
      expect([offset.page, offset.size, offset.skip]).toEqual([1, 10, 0]);
    });

    it('query 문자열을 숫자로 바꾸고 skip을 계산한다', () => {
      const offset = plainToInstance(OffsetPaginationQueryDto, {
        page: '3',
        size: '20',
      });
      expect(validateSync(offset)).toHaveLength(0);
      expect(offset.skip).toBe(40);
    });

    it('최대 크기를 넘으면 검증에 실패한다', () => {
      const cursor = plainToInstance(CursorPaginationQueryDto, {
        limit: '101',
      });
      expect(validateSync(cursor)).not.toHaveLength(0);
    });
  });
});
