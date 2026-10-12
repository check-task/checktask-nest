import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

// ===== 커서 페이지네이션 (무한 스크롤, 계속 쌓이는 목록) =====

/**
 * 커서 페이지네이션 요청 query. 목록 API별 query DTO는 이 클래스를 상속해 필터 필드를 추가한다.
 * @example GET /alarms?cursor=120&limit=10
 */
export class CursorPaginationQueryDto {
  @ApiPropertyOptional({
    description: '이전 응답의 meta.cursor (첫 페이지는 생략)',
    example: 120,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;
}

// 레거시(checktask-back)와 같은 응답 형태: { [목록 키]: [...], meta: { hasNextPage, cursor } }
export interface CursorMeta {
  hasNextPage: boolean;
  cursor: number | null; // 다음 요청에 보낼 커서 (마지막 페이지면 null)
}

export type CursorPage<K extends string, T> = Record<K, T[]> & {
  meta: CursorMeta;
};

/**
 * limit + 1개 조회한 결과로 커서 페이지 응답을 만든다.
 * @param rows limit + 1개까지 조회한 결과 (하나 더 있으면 다음 페이지가 있다는 뜻)
 * @param key 목록을 담을 응답 키 (레거시 응답 키를 그대로 쓴다. 예: 'alarmList')
 * @param getCursor 다음 커서로 쓸 값 (기본: id)
 * @example
 * const rows = await repo.find({ where: { id: LessThan(cursor) }, order: { id: 'DESC' }, take: limit + 1 });
 * return toCursorPage(rows.map(AlarmResponseDto.from), limit, 'alarmList', (row) => row.alarmId);
 * // → { alarmList: [...], meta: { hasNextPage: true, cursor: 120 } }
 */
export const toCursorPage = <K extends string, T>(
  rows: T[],
  limit: number,
  key: K,
  getCursor: (row: T) => number = (row) => (row as { id: number }).id,
): CursorPage<K, T> => {
  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const meta: CursorMeta = {
    hasNextPage,
    cursor: hasNextPage && last !== undefined ? getCursor(last) : null,
  };
  return { [key]: items, meta } as CursorPage<K, T>;
};

// ===== 오프셋 페이지네이션 (페이지 번호 UI, 전체 개수가 필요한 목록) =====

/**
 * 오프셋 페이지네이션 요청 query. page는 1부터 시작한다.
 * @example GET /tasks?page=2&size=10
 */
export class OffsetPaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  size: number = DEFAULT_PAGE_SIZE;

  // TypeORM find 옵션의 skip 값
  get skip(): number {
    return (this.page - 1) * this.size;
  }
}

// 커서 페이지와 같은 형태: { [목록 키]: [...], meta: { hasNextPage, page, size, totalCount } }
export interface OffsetMeta {
  hasNextPage: boolean;
  page: number;
  size: number;
  totalCount: number;
}

export type OffsetPage<K extends string, T> = Record<K, T[]> & {
  meta: OffsetMeta;
};

/**
 * @example
 * const [items, totalCount] = await repo.findAndCount({ skip: query.skip, take: query.size });
 * return toOffsetPage(items.map(TaskResponseDto.from), totalCount, query, 'taskList');
 */
export const toOffsetPage = <K extends string, T>(
  items: T[],
  totalCount: number,
  { page, size }: Pick<OffsetPaginationQueryDto, 'page' | 'size'>,
  key: K,
): OffsetPage<K, T> => {
  const meta: OffsetMeta = {
    hasNextPage: page * size < totalCount,
    page,
    size,
    totalCount,
  };
  return { [key]: items, meta } as OffsetPage<K, T>;
};
