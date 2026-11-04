import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateTaskDto,
  GetCompletedTasksQueryDto,
  GetTasksQueryDto,
  SetSubTaskAssigneeDto,
  CheckTaskTypeQueryDto,
  UpdateSubTaskDeadlineDto,
  toDDay,
} from '../../../src/tasks/task.dto';

// main.ts의 ValidationPipe({ whitelist, transform })와 같은 방식으로 변환·검증한다
const parse = async <T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
) => {
  const dto = plainToInstance(cls, plain);
  const errors = await validate(dto, { whitelist: true });
  return { dto, errors };
};

describe('task.dto', () => {
  describe('toDDay', () => {
    const now = new Date('2026-10-20T03:00:00.000Z'); // KST 20일 12:00

    it('KST 날짜 기준으로 D-Day를 계산한다', () => {
      expect(toDDay(new Date('2026-10-20T14:59:00.000Z'), now)).toBe('D-Day');
      // KST 21일 00:30 → 시각 차이는 12시간 남짓이어도 날짜로는 하루 뒤
      expect(toDDay(new Date('2026-10-20T15:30:00.000Z'), now)).toBe('D-1');
      expect(toDDay(new Date('2026-10-17T03:00:00.000Z'), now)).toBe('D+3');
    });
  });

  describe('CreateTaskDto', () => {
    it('제목이 10자를 넘으면 레거시 문구로 실패한다', async () => {
      const { errors } = await parse(CreateTaskDto, {
        title: '열한글자가넘는과제제목',
        deadline: '2026-10-20T23:59:00+09:00',
      });
      expect(errors[0].constraints).toEqual({
        maxLength: '과제명은 10자 이하여야 합니다.',
      });
    });

    it('type·subTasks 기본값을 채우고, 오프셋 날짜를 Date로 바꾼다', async () => {
      const { dto, errors } = await parse(CreateTaskDto, {
        title: '  발표  ',
        deadline: '2026-10-20T23:59:00+09:00',
        folderId: '3',
      });
      expect(errors).toEqual([]);
      expect(dto).toMatchObject({
        title: '발표',
        type: 'PERSONAL',
        folderId: 3,
        subTasks: [],
        deadline: new Date('2026-10-20T14:59:00.000Z'),
      });
    });
  });

  describe('UpdateSubTaskDeadlineDto', () => {
    it('빈 문자열은 null(마감일 미지정)로 받는다', async () => {
      const { dto, errors } = await parse(UpdateSubTaskDeadlineDto, {
        endDate: '',
      });
      expect(errors).toEqual([]);
      expect(dto.endDate).toBeNull();
    });

    it('endDate가 없으면 실패한다', async () => {
      const { errors } = await parse(UpdateSubTaskDeadlineDto, {});
      expect(errors).toHaveLength(1);
    });
  });

  describe('SetSubTaskAssigneeDto', () => {
    it('null은 담당자 해제로 통과하고, 숫자 문자열은 숫자로 바꾼다', async () => {
      expect(
        (await parse(SetSubTaskAssigneeDto, { assigneeId: null })).errors,
      ).toEqual([]);
      const { dto } = await parse(SetSubTaskAssigneeDto, { assigneeId: '2' });
      expect(dto.assigneeId).toBe(2);
    });

    it('assigneeIds는 숫자 문자열도 숫자로 바꾸고, 0 이하는 실패한다', async () => {
      const { dto, errors } = await parse(SetSubTaskAssigneeDto, {
        assigneeIds: ['2', 3],
      });
      expect(errors).toEqual([]);
      expect(dto.assigneeIds).toEqual([2, 3]);
      expect(
        (await parse(SetSubTaskAssigneeDto, { assigneeIds: [0] })).errors,
      ).toHaveLength(1);
    });
  });

  it('GetCompletedTasksQueryDto는 쉼표로 구분한 폴더 ID를 숫자 배열로 바꾼다', async () => {
    const { dto, errors } = await parse(GetCompletedTasksQueryDto, {
      folderId: '1,2,abc',
    });
    expect(errors).toEqual([]);
    expect(dto.folderId).toEqual([1, 2]);
  });

  it('CheckTaskTypeQueryDto는 소문자 type도 받는다', async () => {
    const { dto, errors } = await parse(CheckTaskTypeQueryDto, {
      type: 'team',
    });
    expect(errors).toEqual([]);
    expect(dto.type).toBe('TEAM');
  });

  it('목록 query는 페이지네이션 기본값(page 1, size 10)을 채운다', async () => {
    const { dto, errors } = await parse(GetTasksQueryDto, { sort: 'DEADLINE' });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 1, size: 10, sort: 'DEADLINE' });
    expect(dto.skip).toBe(0);
  });
});
