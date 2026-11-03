import { EntityManager } from 'typeorm';
import { AlarmService } from '../../../src/alarms/alarm.service';
import { UserAlarm } from '../../../src/alarms/user-alarm.entity';
import { AlarmType, SubTaskStatus } from '../../../src/common/enums';
import { UserService } from '../../../src/users/user.service';

const HOUR = 3600_000;
const DEADLINE = new Date('2026-10-20T14:59:00.000Z');

describe('AlarmService', () => {
  let manager: Record<string, ReturnType<typeof vi.fn>>;
  let getAlarmHours: ReturnType<typeof vi.fn>;
  let service: AlarmService;

  beforeEach(() => {
    manager = {
      insert: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
      delete: vi.fn(),
    };
    // 유저 1만 알림 설정이 있다 (과제 12시간 전, 세부 과제 6시간 전)
    getAlarmHours = vi
      .fn()
      .mockResolvedValue(new Map([[1, { deadlineAlarm: 12, taskAlarm: 6 }]]));
    service = new AlarmService({ getAlarmHours } as unknown as UserService);
  });

  const em = () => manager as unknown as EntityManager;
  const inserted = (): UserAlarm[] =>
    manager.insert.mock.calls.flatMap(([, rows]) => rows as UserAlarm[]);

  const subTask = (overrides = {}) => ({
    id: 50,
    taskId: 10,
    title: '자료 조사',
    status: SubTaskStatus.PENDING,
    endDate: DEADLINE,
    isAlarm: true,
    ...overrides,
  });

  it('과제 알림은 유저 설정(없으면 24시간) 전으로 잡고 진행률을 담는다', async () => {
    await service.createTaskAlarms(
      em(),
      { id: 10, title: '중간 발표', deadline: DEADLINE },
      [1, 2],
      50,
    );
    const [mine, other] = inserted();
    expect(mine).toMatchObject({
      type: AlarmType.TASK,
      title: "'중간 발표'의 마감까지 12시간 남았어요!",
      alarmContent: "'현재 50%완성 중이에요. 빨리 끝내고 쉬어요!",
      alarmDate: new Date(DEADLINE.getTime() - 12 * HOUR),
    });
    expect(other.alarmDate).toEqual(new Date(DEADLINE.getTime() - 24 * HOUR));
  });

  it('담당자가 여러 명이면 담당자마다 알림을 만든다', async () => {
    await service.createSubTaskAlarms(em(), [
      { subTask: subTask(), assigneeUserIds: [1, 2] },
    ]);
    expect(inserted().map((alarm) => [alarm.userId, alarm.alarmDate])).toEqual([
      [1, new Date(DEADLINE.getTime() - 6 * HOUR)],
      [2, new Date(DEADLINE.getTime() - 24 * HOUR)],
    ]);
  });

  it('마감일·담당자가 없거나 알림이 꺼진 세부 과제는 알림을 만들지 않는다', async () => {
    await service.createSubTaskAlarms(em(), [
      { subTask: subTask({ endDate: null }), assigneeUserIds: [1] },
      { subTask: subTask({ isAlarm: false }), assigneeUserIds: [1] },
      { subTask: subTask(), assigneeUserIds: [] },
    ]);
    expect(manager.insert).not.toHaveBeenCalled();
  });

  it('알림 문구는 DB 길이(50자)에 맞춰 자른다', async () => {
    await service.createSubTaskAlarms(em(), [
      { subTask: subTask({ title: '가'.repeat(60) }), assigneeUserIds: [1] },
    ]);
    expect(inserted()[0].title).toHaveLength(50);
  });

  describe('syncSubTaskAlarms', () => {
    it('담당자의 기존 알림은 고치고, 다른 사람 앞으로 남은 알림은 지운다', async () => {
      const own = { id: 1, userId: 1, subTaskId: 50 } as UserAlarm;
      manager.find.mockResolvedValue([
        own,
        { id: 2, userId: 3, subTaskId: 50 },
      ]);

      await service.syncSubTaskAlarms(em(), [
        { subTask: subTask(), assigneeUserIds: [1] },
      ]);

      expect(manager.save).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 1,
          alarmDate: new Date(DEADLINE.getTime() - 6 * HOUR),
        }),
      ]);
      expect(manager.delete).toHaveBeenCalledWith(UserAlarm, {
        id: expect.objectContaining({ _value: [2] }),
      });
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('담당자가 추가되면 기존 알림은 고치고 새 담당자 알림만 만든다', async () => {
      manager.find.mockResolvedValue([{ id: 1, userId: 1, subTaskId: 50 }]);
      await service.syncSubTaskAlarms(em(), [
        { subTask: subTask(), assigneeUserIds: [1, 2] },
      ]);
      expect(manager.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: 1 }),
      ]);
      expect(inserted()).toEqual([expect.objectContaining({ userId: 2 })]);
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('알림이 없던 세부 과제는 새로 만든다', async () => {
      await service.syncSubTaskAlarms(em(), [
        { subTask: subTask(), assigneeUserIds: [1] },
      ]);
      expect(inserted()).toEqual([
        expect.objectContaining({ userId: 1, subTaskId: 50 }),
      ]);
    });

    it('마감일이 없어지면 기존 알림을 지운다', async () => {
      manager.find.mockResolvedValue([{ id: 1, userId: 1, subTaskId: 50 }]);
      await service.syncSubTaskAlarms(em(), [
        { subTask: subTask({ endDate: null }), assigneeUserIds: [1] },
      ]);
      expect(manager.delete).toHaveBeenCalledWith(UserAlarm, {
        id: expect.objectContaining({ _value: [1] }),
      });
    });
  });

  it('과제 마감일이 바뀌면 과제 알림만 새 마감일 기준으로 다시 잡는다', async () => {
    const alarm = { id: 1, userId: 1 } as UserAlarm;
    manager.find.mockResolvedValue([alarm]);
    const deadline = new Date('2026-10-25T00:00:00.000Z');

    await service.rescheduleTaskAlarms(em(), 10, deadline);

    // TASK 알림 + type이 없는 레거시 알림만 조회한다 (팀원 참여 알림 제외)
    expect(manager.find.mock.calls[0][1].where).toEqual([
      expect.objectContaining({ taskId: 10, type: AlarmType.TASK }),
      expect.objectContaining({ taskId: 10 }),
    ]);
    expect(alarm.alarmDate).toEqual(new Date(deadline.getTime() - 12 * HOUR));
  });
});
