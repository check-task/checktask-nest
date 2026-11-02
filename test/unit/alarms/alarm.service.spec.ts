import { DataSource, EntityManager, Repository } from 'typeorm';
import { AlarmType } from '../../../src/alarms/alarm-type.enum';
import { UserAlarm } from '../../../src/alarms/alarm.entity';
import {
  AlarmService,
  buildDeadlineTitle,
  buildMemberJoinContent,
  fcmTokenKey,
  pushedAlarmKey,
} from '../../../src/alarms/alarm.service';
import { FcmService } from '../../../src/common/fcm/fcm.service';
import { RedisService } from '../../../src/common/redis/redis.service';
import { Member } from '../../../src/tasks/entities/member.entity';
import { SubTask } from '../../../src/tasks/entities/sub-task.entity';
import { Task } from '../../../src/tasks/entities/task.entity';
import { User } from '../../../src/users/entities/user.entity';

const repository = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  existsBy: vi.fn(),
});

describe('AlarmService', () => {
  const alarmRepository = repository();
  const userRepository = repository();
  const taskRepository = repository();
  const subTaskRepository = repository();
  const memberRepository = repository();
  const assigneeRepository = repository();
  const manager = {
    update: vi.fn(),
    findOneByOrFail: vi.fn(),
    findOneBy: vi.fn(),
    find: vi.fn(),
    delete: vi.fn(),
    save: vi.fn(),
    create: vi.fn((_: unknown, data: unknown) => data),
    getRepository: vi.fn(),
  };
  const dataSource = {
    manager,
    transaction: vi.fn((work: (m: EntityManager) => unknown) =>
      work(manager as unknown as EntityManager),
    ),
    getRepository: vi.fn(() => assigneeRepository),
  };
  const redisService = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
  const fcmService = { send: vi.fn() };

  const service = new AlarmService(
    alarmRepository as unknown as Repository<UserAlarm>,
    userRepository as unknown as Repository<User>,
    taskRepository as unknown as Repository<Task>,
    subTaskRepository as unknown as Repository<SubTask>,
    memberRepository as unknown as Repository<Member>,
    dataSource as unknown as DataSource,
    redisService as unknown as RedisService,
    fcmService as unknown as FcmService,
  );

  const activeUser = { id: 1, nickname: '준우', deletedAt: null };
  const alarm = {
    id: 10,
    userId: 1,
    taskId: 3,
    subTaskId: null,
    title: "'발표'의 마감까지 24시간 남았어요!",
    alarmContent: '내용',
    isRead: false,
  };

  beforeEach(() => vi.clearAllMocks());

  describe('알림 문구', () => {
    it('마감 알림 제목은 레거시 문구를 따른다', () => {
      expect(buildDeadlineTitle('발표', 24)).toBe(
        "'발표'의 마감까지 24시간 남았어요!",
      );
    });

    it('세부 과제 이름이 길면 잘라서 50자를 넘지 않게 한다', () => {
      const title = buildDeadlineTitle('가'.repeat(100), 24);
      expect(title.length).toBeLessThanOrEqual(50);
      expect(title.endsWith("…'의 마감까지 24시간 남았어요!")).toBe(true);
    });

    it('팀원 참여 내용도 50자를 넘지 않는다', () => {
      expect(
        buildMemberJoinContent('나'.repeat(30), '가'.repeat(10)).length,
      ).toBeLessThanOrEqual(50);
      expect(buildMemberJoinContent('준우', '발표')).toBe(
        "준우님이 '발표'에 참여했습니다.",
      );
    });
  });

  describe('updateAlarmReadStatus', () => {
    it('알림이 없으면 ALARM_NOT_FOUND', async () => {
      alarmRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateAlarmReadStatus(1, 10, true),
      ).rejects.toMatchObject({ errorCode: 'ALARM_NOT_FOUND' });
    });

    it('다른 사용자의 알림이면 FORBIDDEN_ALARM이고 수정하지 않는다', async () => {
      alarmRepository.findOne.mockResolvedValue({ ...alarm, userId: 2 });
      await expect(
        service.updateAlarmReadStatus(1, 10, true),
      ).rejects.toMatchObject({
        errorCode: 'FORBIDDEN_ALARM',
        statusCode: 403,
      });
      expect(alarmRepository.update).not.toHaveBeenCalled();
    });

    it('본인 알림이면 읽음 처리하고 레거시 형태로 반환한다', async () => {
      alarmRepository.findOne.mockResolvedValue(alarm);
      await expect(service.updateAlarmReadStatus(1, 10, true)).resolves.toEqual(
        {
          alarm: {
            alarmId: 10,
            userId: 1,
            taskId: 3,
            subTaskId: null,
            title: alarm.title,
            alarmContent: '내용',
            isRead: true,
          },
        },
      );
      expect(alarmRepository.update).toHaveBeenCalledWith(
        { id: 10 },
        { isRead: true },
      );
    });
  });

  describe('deleteAlarm', () => {
    it('탈퇴한 사용자는 USER_DELETED', async () => {
      userRepository.findOne.mockResolvedValue({
        ...activeUser,
        deletedAt: new Date(),
      });
      await expect(service.deleteAlarm(1, 10)).rejects.toMatchObject({
        errorCode: 'USER_DELETED',
      });
    });

    it('사용자가 없으면 USER_NOT_FOUND', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.deleteAlarm(1, 10)).rejects.toMatchObject({
        errorCode: 'USER_NOT_FOUND',
      });
    });

    it('본인 알림이면 삭제하고 null을 반환한다', async () => {
      userRepository.findOne.mockResolvedValue(activeUser);
      alarmRepository.findOne.mockResolvedValue(alarm);
      await expect(service.deleteAlarm(1, 10)).resolves.toBeNull();
      expect(alarmRepository.delete).toHaveBeenCalledWith({ id: 10 });
    });
  });

  it('getUnreadAlarmCount는 개수와 hasUnread를 반환한다', async () => {
    userRepository.findOne.mockResolvedValue(activeUser);
    alarmRepository.count.mockResolvedValue(3);
    await expect(service.getUnreadAlarmCount(1)).resolves.toEqual({
      count: 3,
      hasUnread: true,
    });
  });

  it('registerDevice는 Redis에 30일 동안 토큰을 저장한다', async () => {
    await expect(service.registerDevice(1, 'token')).resolves.toBeNull();
    expect(redisService.set).toHaveBeenCalledWith(
      'fcm_token:1',
      'token',
      60 * 60 * 24 * 30,
    );
  });

  describe('sendTestPush', () => {
    it('토큰이 없으면 FCM_TOKEN_NOT_FOUND', async () => {
      redisService.get.mockResolvedValue(null);
      await expect(
        service.sendTestPush(1, '제목', '내용'),
      ).rejects.toMatchObject({ errorCode: 'FCM_TOKEN_NOT_FOUND' });
      expect(fcmService.send).not.toHaveBeenCalled();
    });

    it('저장된 토큰으로 발송한다', async () => {
      redisService.get.mockResolvedValue('token');
      fcmService.send.mockResolvedValue('SENT');
      await expect(service.sendTestPush(1, '제목', '내용')).resolves.toBeNull();
      expect(fcmService.send).toHaveBeenCalledWith('token', '제목', '내용');
    });

    it('만료된 토큰이면 지우고 FCM_TOKEN_NOT_FOUND', async () => {
      redisService.get.mockResolvedValue('token');
      fcmService.send.mockResolvedValue('INVALID_TOKEN');
      await expect(
        service.sendTestPush(1, '제목', '내용'),
      ).rejects.toMatchObject({ errorCode: 'FCM_TOKEN_NOT_FOUND' });
      expect(redisService.del).toHaveBeenCalledWith('fcm_token:1');
    });

    it('발송 실패면 PUSH_SEND_FAILED', async () => {
      redisService.get.mockResolvedValue('token');
      fcmService.send.mockResolvedValue('FAILED');
      await expect(
        service.sendTestPush(1, '제목', '내용'),
      ).rejects.toMatchObject({ errorCode: 'PUSH_SEND_FAILED' });
    });
  });

  describe('updateSubTaskAlarmStatus', () => {
    const subTask = { id: 5, taskId: 3, isAlarm: false, title: '자료 조사' };

    it('세부 과제가 없으면 SUBTASK_NOT_FOUND', async () => {
      subTaskRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateSubTaskAlarmStatus(1, 5, true),
      ).rejects.toMatchObject({ errorCode: 'SUBTASK_NOT_FOUND' });
    });

    it('과제 참여자가 아니면 FORBIDDEN_TASK', async () => {
      subTaskRepository.findOne.mockResolvedValue(subTask);
      memberRepository.existsBy.mockResolvedValue(false);
      await expect(
        service.updateSubTaskAlarmStatus(1, 5, true),
      ).rejects.toMatchObject({ errorCode: 'FORBIDDEN_TASK' });
    });

    it('담당자 없이 켜면 SUBTASK_NO_ASSIGNEE이고 값을 바꾸지 않는다', async () => {
      subTaskRepository.findOne.mockResolvedValue(subTask);
      memberRepository.existsBy.mockResolvedValue(true);
      assigneeRepository.existsBy.mockResolvedValue(false);
      await expect(
        service.updateSubTaskAlarmStatus(1, 5, true),
      ).rejects.toMatchObject({ errorCode: 'SUBTASK_NO_ASSIGNEE' });
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('끄면 아직 보내지 않은 알림만 지운다', async () => {
      subTaskRepository.findOne.mockResolvedValue({
        ...subTask,
        isAlarm: true,
      });
      memberRepository.existsBy.mockResolvedValue(true);
      manager.findOneByOrFail.mockResolvedValue(subTask);
      await service.updateSubTaskAlarmStatus(1, 5, false);
      expect(manager.update).toHaveBeenCalledWith(
        SubTask,
        { id: 5 },
        { isAlarm: false },
      );
      expect(manager.delete).toHaveBeenCalledWith(
        UserAlarm,
        expect.objectContaining({ subTaskId: 5 }),
      );
    });
  });

  describe('createTaskAlarms', () => {
    it('알림이 없는 참여자에게만 각자 설정 시간으로 알림을 만든다', async () => {
      const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      manager.findOneBy.mockResolvedValue({
        id: 3,
        title: '발표',
        isAlarm: true,
        deadline,
      });
      manager.find
        .mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }]) // 참여자
        .mockResolvedValueOnce([{ userId: 2 }]) // 이미 알림이 있는 사용자
        .mockResolvedValueOnce([{ userId: 1, deadlineAlarm: 12 }]); // 알림 설정
      const queryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setParameter: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi
          .fn()
          .mockResolvedValue([{ taskId: 3, total: '4', completed: '1' }]),
      };
      manager.getRepository.mockReturnValueOnce({
        createQueryBuilder: () => queryBuilder,
      });

      await service.createTaskAlarms(3);

      expect(manager.save).toHaveBeenCalledWith(UserAlarm, [
        {
          userId: 1,
          taskId: 3,
          type: AlarmType.TASK,
          title: "'발표'의 마감까지 12시간 남았어요!",
          alarmContent: "'현재 25%완성 중이에요. 빨리 끝내고 쉬어요!",
          alarmDate: new Date(deadline.getTime() - 12 * 60 * 60 * 1000),
          isRead: false,
        },
      ]);
    });

    it('마감이 지난 과제는 알림을 만들지 않는다', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 3,
        isAlarm: true,
        deadline: new Date(Date.now() - 1000),
      });
      await service.createTaskAlarms(3);
      expect(manager.save).not.toHaveBeenCalled();
    });
  });

  describe('sendDueAlarms', () => {
    it('보낸 적 없는 알림만 발송하고, 성공하면 발송 표시를 남긴다', async () => {
      alarmRepository.find.mockResolvedValue([
        { ...alarm, id: 10 },
        { ...alarm, id: 11 },
      ]);
      redisService.get.mockImplementation((key: string) => {
        if (key === pushedAlarmKey(11)) return Promise.resolve('1');
        if (key === fcmTokenKey(1)) return Promise.resolve('token');
        return Promise.resolve(null);
      });
      fcmService.send.mockResolvedValue('SENT');

      await service.sendDueAlarms();

      expect(fcmService.send).toHaveBeenCalledTimes(1);
      expect(fcmService.send).toHaveBeenCalledWith(
        'token',
        alarm.title,
        '내용',
      );
      expect(redisService.set).toHaveBeenCalledWith(
        pushedAlarmKey(10),
        '1',
        expect.any(Number),
      );
    });

    it('토큰이 없으면 보내지 않고, 만료된 토큰은 지운다', async () => {
      alarmRepository.find.mockResolvedValue([
        { ...alarm, id: 10, userId: 1 },
        { ...alarm, id: 12, userId: 2 },
      ]);
      redisService.get.mockImplementation((key: string) =>
        Promise.resolve(key === fcmTokenKey(2) ? 'old-token' : null),
      );
      fcmService.send.mockResolvedValue('INVALID_TOKEN');

      await service.sendDueAlarms();

      expect(fcmService.send).toHaveBeenCalledTimes(1);
      expect(redisService.del).toHaveBeenCalledWith(fcmTokenKey(2));
      expect(redisService.set).not.toHaveBeenCalled();
    });
  });
});
