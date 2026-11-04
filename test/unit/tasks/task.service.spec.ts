import { DataSource, Repository } from 'typeorm';
import { SubTaskStatus, TaskStatus, TaskType } from '../../../src/common/enums';
import { CustomError } from '../../../src/common/response/error/custom.error';
import { Folder } from '../../../src/folders/folder.entity';
import { ReferenceService } from '../../../src/references/reference.service';
import { Member } from '../../../src/tasks/entities/member.entity';
import { SubTaskAssignee } from '../../../src/tasks/entities/sub-task-assignee.entity';
import { AlarmService } from '../../../src/alarms/alarm.service';
import { SubTask } from '../../../src/tasks/entities/sub-task.entity';
import { TaskPriority } from '../../../src/tasks/entities/task-priority.entity';
import { Task } from '../../../src/tasks/entities/task.entity';
import { CreateTaskDto } from '../../../src/tasks/task.dto';
import {
  TaskService,
  calculateProgressRate,
} from '../../../src/tasks/task.service';
import { User } from '../../../src/users/entities/user.entity';

const createRepository = () => ({
  findOne: vi.fn(),
  find: vi.fn().mockResolvedValue([]),
  exists: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  upsert: vi.fn(),
});

const USER_ID = 1;
// 아직 마감 전인 과제 (마감이 지난 과제는 TASK_DEADLINE_EXPIRED를 따로 검사)
const DEADLINE = new Date(Date.now() + 30 * 24 * 3600_000);
const PAST_DEADLINE = new Date(Date.now() - 24 * 3600_000);

const task = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 10,
    title: '중간 발표',
    deadline: DEADLINE,
    type: TaskType.PERSONAL,
    status: TaskStatus.PENDING,
    isAlarm: true,
    inviteCode: null,
    inviteExpiredAt: null,
    ...overrides,
  }) as Task;

const member = (overrides: Partial<Member> = {}): Member =>
  ({
    id: 100,
    userId: USER_ID,
    taskId: 10,
    folderId: 5,
    role: false,
    ...overrides,
  }) as Member;

const errorCodeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'NO_ERROR',
    (error: unknown) => (error as CustomError).errorCode,
  );

describe('TaskService', () => {
  let repositories: Record<string, ReturnType<typeof createRepository>>;
  let manager: Record<string, ReturnType<typeof vi.fn>>;
  let alarmService: Record<string, ReturnType<typeof vi.fn>>;
  let referenceService: Record<string, ReturnType<typeof vi.fn>>;
  let service: TaskService;
  let nextId: number;

  beforeEach(() => {
    nextId = 1000;
    repositories = {
      task: createRepository(),
      subTask: createRepository(),
      member: createRepository(),
      taskPriority: createRepository(),
      user: createRepository(),
      folder: createRepository(),
    };
    repositories.user.exists.mockResolvedValue(true);
    repositories.folder.findOne.mockResolvedValue({ id: 7, userId: USER_ID });
    manager = {
      create: vi.fn((_: unknown, data: object) => ({ ...data })),
      save: vi.fn(async (entity: object | object[]) =>
        Array.isArray(entity)
          ? entity.map((item) => ({ id: nextId++, ...item }))
          : { id: nextId++, ...entity },
      ),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({ id: USER_ID, nickname: '소윤' }),
      maximum: vi.fn().mockResolvedValue(null),
    };
    alarmService = {
      createTaskAlarms: vi.fn(),
      createSubTaskAlarms: vi.fn(),
      createMemberJoinAlarms: vi.fn(),
      updateTaskAlarmDates: vi.fn(),
      updateSubTaskAlarmDates: vi.fn(),
      deleteSubTaskAlarms: vi.fn(),
      deleteAlarmsByUserAndTask: vi.fn(),
    };
    referenceService = {
      createForTask: vi.fn(),
      findAllByTaskId: vi.fn(),
    };
    const dataSource = {
      transaction: vi.fn((work: (m: unknown) => unknown) => work(manager)),
    } as unknown as DataSource;

    const asRepository = <T extends object>(key: string) =>
      repositories[key] as unknown as Repository<T>;
    service = new TaskService(
      dataSource,
      asRepository<Task>('task'),
      asRepository<SubTask>('subTask'),
      asRepository<Member>('member'),
      asRepository<TaskPriority>('taskPriority'),
      asRepository<User>('user'),
      asRepository<Folder>('folder'),
      alarmService as unknown as AlarmService,
      referenceService as unknown as ReferenceService,
    );
  });

  // manager.find(Entity, ...) 결과를 엔티티별로 지정한다
  const mockManagerFind = (results: Map<unknown, unknown[]>) =>
    manager.find.mockImplementation(async (entity: unknown) =>
      Promise.resolve(results.get(entity) ?? []),
    );

  const givenAccessibleTask = (
    taskOverrides: Partial<Task> = {},
    memberOverrides: Partial<Member> = {},
  ) => {
    repositories.task.findOne.mockResolvedValue(task(taskOverrides));
    repositories.member.findOne.mockResolvedValue(member(memberOverrides));
  };

  describe('과제 접근 권한 (레거시 validateTaskType)', () => {
    it('과제가 없으면 TASK_NOT_FOUND', async () => {
      repositories.task.findOne.mockResolvedValue(null);
      repositories.member.findOne.mockResolvedValue(member());
      expect(await errorCodeOf(service.convertTaskToTeam(10, USER_ID))).toBe(
        'TASK_NOT_FOUND',
      );
    });

    it('?type과 과제 종류가 다르면 TASK_TYPE_MISMATCH', async () => {
      givenAccessibleTask();
      expect(
        await errorCodeOf(
          service.generateInviteCode(10, USER_ID, TaskType.TEAM),
        ),
      ).toBe('TASK_TYPE_MISMATCH');
    });

    it('참여자가 아니면 FORBIDDEN_TASK', async () => {
      repositories.task.findOne.mockResolvedValue(task());
      repositories.member.findOne.mockResolvedValue(null);
      expect(await errorCodeOf(service.getTaskMembers(10, USER_ID))).toBe(
        'FORBIDDEN_TASK',
      );
    });

    it('개인 과제를 소유자가 아닌 참여자가 접근하면 FORBIDDEN_PERSONAL_TASK', async () => {
      givenAccessibleTask({}, { role: true });
      expect(await errorCodeOf(service.convertTaskToTeam(10, USER_ID))).toBe(
        'FORBIDDEN_PERSONAL_TASK',
      );
    });
  });

  describe('사용자·폴더 확인', () => {
    const createDto = (folderId?: number | null): CreateTaskDto =>
      Object.assign(new CreateTaskDto(), {
        title: '중간 발표',
        deadline: DEADLINE,
        folderId,
      });

    it('사용자가 없으면 USER_NOT_FOUND', async () => {
      repositories.user.exists.mockResolvedValue(false);
      expect(
        await errorCodeOf(
          service.getCompletedTasks(
            {} as Parameters<TaskService['getCompletedTasks']>[0],
            USER_ID,
          ),
        ),
      ).toBe('USER_NOT_FOUND');
    });

    it('folderId가 없으면 "지정안함" 폴더를 쓴다', async () => {
      await service.createTask(createDto(null), USER_ID);
      expect(repositories.folder.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, folderTitle: '지정안함' },
        }),
      );
    });

    it('기본 폴더가 없으면 DEFAULT_FOLDER_NOT_FOUND', async () => {
      repositories.folder.findOne.mockResolvedValue(null);
      expect(await errorCodeOf(service.createTask(createDto(), USER_ID))).toBe(
        'DEFAULT_FOLDER_NOT_FOUND',
      );
    });

    it('폴더가 없으면 FOLDER_NOT_FOUND, 다른 사용자 폴더면 FORBIDDEN_FOLDER', async () => {
      repositories.folder.findOne.mockResolvedValueOnce(null);
      expect(await errorCodeOf(service.createTask(createDto(3), USER_ID))).toBe(
        'FOLDER_NOT_FOUND',
      );
      repositories.folder.findOne.mockResolvedValueOnce({ id: 3, userId: 2 });
      expect(await errorCodeOf(service.createTask(createDto(3), USER_ID))).toBe(
        'FORBIDDEN_FOLDER',
      );
    });
  });

  describe('createTask', () => {
    const dto = (overrides: Partial<CreateTaskDto> = {}): CreateTaskDto =>
      Object.assign(new CreateTaskDto(), {
        title: '중간 발표',
        deadline: DEADLINE,
        ...overrides,
      });

    it('지정한 폴더가 본인 폴더인지 확인한다', async () => {
      await service.createTask(dto({ folderId: 3 }), USER_ID);
      expect(repositories.folder.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 } }),
      );
      expect(manager.create).toHaveBeenCalledWith(
        Member,
        expect.objectContaining({ folderId: 7, role: false }),
      );
    });

    it('세부 과제 마감일이 과제 마감일보다 늦으면 INVALID_DEADLINE', async () => {
      const late = new Date(DEADLINE.getTime() + 1000);
      expect(
        await errorCodeOf(
          service.createTask(
            dto({ subTasks: [{ title: '조사', endDate: late }] }),
            USER_ID,
          ),
        ),
      ).toBe('INVALID_DEADLINE');
    });

    it('마감이 지난 과제에 마감일이 더 늦은 세부 과제를 넣으면 TASK_DEADLINE_EXPIRED', async () => {
      expect(
        await errorCodeOf(
          service.createTask(
            dto({
              deadline: PAST_DEADLINE,
              subTasks: [{ title: '조사', endDate: DEADLINE }],
            }),
            USER_ID,
          ),
        ),
      ).toBe('TASK_DEADLINE_EXPIRED');
    });

    it('팀 과제는 담당자를 지정하지 않으면 담당자 없이 만든다', async () => {
      await service.createTask(
        dto({
          type: TaskType.TEAM,
          subTasks: [{ title: '조사', endDate: DEADLINE }],
        }),
        USER_ID,
      );
      expect(manager.insert).not.toHaveBeenCalledWith(
        SubTaskAssignee,
        expect.anything(),
      );
      expect(alarmService.createSubTaskAlarms).toHaveBeenCalledWith(
        1002,
        manager,
      );
    });

    it('우선순위를 맨 뒤로 두고, 개인 과제는 소유자 담당 세부 과제·알림·자료를 만든다', async () => {
      manager.maximum.mockResolvedValue(3);
      const subDeadline = new Date(DEADLINE.getTime() - 24 * 3600_000);

      await service.createTask(
        dto({
          subTasks: [{ title: '조사', endDate: subDeadline }],
          references: [{ name: '링크', url: 'https://a.com' }],
        }),
        USER_ID,
      );

      expect(manager.insert).toHaveBeenCalledWith(
        TaskPriority,
        expect.objectContaining({ userId: USER_ID, rank: 4 }),
      );
      expect(alarmService.createTaskAlarms).toHaveBeenCalledWith(
        1000,
        manager,
        [USER_ID],
      );
      // 소유자(Member 1001)가 세부 과제(1002)를 담당한다
      expect(manager.insert).toHaveBeenCalledWith(SubTaskAssignee, [
        { subTaskId: 1002, memberId: 1001 },
      ]);
      expect(alarmService.createSubTaskAlarms).toHaveBeenCalledWith(
        1002,
        manager,
      );
      expect(referenceService.createForTask).toHaveBeenCalledWith(
        manager,
        1000,
        [{ name: '링크', url: 'https://a.com' }],
        [],
      );
    });
  });

  describe('updateTaskPriorities', () => {
    it('참여하지 않은 과제가 섞여 있으면 FORBIDDEN_TASK', async () => {
      repositories.member.count.mockResolvedValue(1);
      expect(
        await errorCodeOf(
          service.updateTaskPriorities(
            {
              orderedTasks: [
                { taskId: 1, rank: 1 },
                { taskId: 2, rank: 2 },
              ],
            },
            USER_ID,
          ),
        ),
      ).toBe('FORBIDDEN_TASK');
      expect(repositories.taskPriority.upsert).not.toHaveBeenCalled();
    });

    it('같은 과제가 여러 번 오면 마지막 순위로 한 번만 upsert한다', async () => {
      repositories.member.count.mockResolvedValue(1);
      await service.updateTaskPriorities(
        {
          orderedTasks: [
            { taskId: 1, rank: 1 },
            { taskId: 1, rank: 3 },
          ],
        },
        USER_ID,
      );
      expect(repositories.taskPriority.upsert).toHaveBeenCalledWith(
        [{ userId: USER_ID, taskId: 1, rank: 3 }],
        ['userId', 'taskId'],
      );
    });
  });

  describe('joinTaskByInviteCode', () => {
    it('초대 코드에 맞는 팀 과제가 없으면 INVITE_CODE_NOT_FOUND', async () => {
      repositories.task.findOne.mockResolvedValue(null);
      expect(
        await errorCodeOf(
          service.joinTaskByInviteCode({ inviteCode: 'X' }, USER_ID),
        ),
      ).toBe('INVITE_CODE_NOT_FOUND');
    });

    it('만료된 코드면 EXPIRED_INVITE_CODE', async () => {
      repositories.task.findOne.mockResolvedValue(
        task({
          type: TaskType.TEAM,
          inviteExpiredAt: new Date(Date.now() - 1000),
        }),
      );
      expect(
        await errorCodeOf(
          service.joinTaskByInviteCode({ inviteCode: 'X' }, USER_ID),
        ),
      ).toBe('EXPIRED_INVITE_CODE');
    });

    it('이미 참여 중이면 DUPLICATE_MEMBER', async () => {
      repositories.task.findOne.mockResolvedValue(
        task({ type: TaskType.TEAM }),
      );
      repositories.member.exists.mockResolvedValue(true);
      expect(
        await errorCodeOf(
          service.joinTaskByInviteCode({ inviteCode: 'X' }, USER_ID),
        ),
      ).toBe('DUPLICATE_MEMBER');
    });

    it('기존 팀원에게 참여 알림, 새 팀원에게 과제 마감 알림을 만든다', async () => {
      repositories.task.findOne.mockResolvedValue(
        task({ type: TaskType.TEAM }),
      );
      repositories.member.exists.mockResolvedValue(false);
      mockManagerFind(
        new Map<unknown, unknown[]>([
          [
            Member,
            [
              { id: 1, userId: 2 },
              { id: 2, userId: 3 },
            ],
          ],
          [
            SubTask,
            [
              { status: SubTaskStatus.COMPLETED },
              { status: SubTaskStatus.PENDING },
            ],
          ],
        ]),
      );

      const result = await service.joinTaskByInviteCode(
        { inviteCode: 'X' },
        USER_ID,
      );

      expect(result).toMatchObject({ task_id: 10, folderId: 7 });
      expect(alarmService.createMemberJoinAlarms).toHaveBeenCalledWith(
        10,
        USER_ID,
        manager,
      );
      expect(alarmService.createTaskAlarms).toHaveBeenCalledWith(10, manager, [
        USER_ID,
      ]);
    });
  });

  describe('setSubTaskAssignee', () => {
    const withUser = (m: Member) =>
      member({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: { id: m.userId, nickname: `유저${m.userId}`, profileImage: null },
      } as Partial<Member>);
    // 현재 담당자: Member 100 (User 1)
    const subTask = (members: Member[]) => ({
      id: 50,
      taskId: 10,
      title: '조사',
      status: SubTaskStatus.PENDING,
      isAlarm: true,
      endDate: DEADLINE,
      assignees: [{ subTaskId: 50, memberId: 100 }],
      task: task({ type: TaskType.TEAM, members: members.map(withUser) }),
    });

    beforeEach(() => {
      repositories.member.exists.mockResolvedValue(true);
    });

    it('과제 참여자가 아니면 ASSIGNEE_NOT_IN_TASK', async () => {
      repositories.subTask.findOne.mockResolvedValue(subTask([member()]));
      expect(
        await errorCodeOf(
          service.setSubTaskAssignee(50, { assigneeId: 99 }, USER_ID),
        ),
      ).toBe('ASSIGNEE_NOT_IN_TASK');
    });

    it('assigneeId·assigneeIds를 합쳐 담당자를 통째로 바꾸고 알림을 맞춘다', async () => {
      const second = member({ id: 101, userId: 2, role: true });
      const third = member({ id: 102, userId: 3, role: true });
      repositories.subTask.findOne.mockResolvedValue(
        subTask([member(), second, third]),
      );

      const result = await service.setSubTaskAssignee(
        50,
        { assigneeId: 2, assigneeIds: [3, 2] },
        USER_ID,
      );

      expect(manager.delete).toHaveBeenCalledWith(SubTaskAssignee, {
        subTaskId: 50,
      });
      expect(manager.insert).toHaveBeenCalledWith(SubTaskAssignee, [
        { subTaskId: 50, memberId: 102 },
        { subTaskId: 50, memberId: 101 },
      ]);
      // 빠진 담당자(User 1)의 알림은 지우고, 새 담당자에게 알림을 만든다
      expect(alarmService.deleteSubTaskAlarms).toHaveBeenCalledWith(
        [50],
        manager,
        [USER_ID],
      );
      expect(alarmService.createSubTaskAlarms).toHaveBeenCalledWith(
        50,
        manager,
      );
      expect(result.assignees.map((a) => a.userId)).toEqual([3, 2]);
    });

    it('담당자를 보내지 않으면 모두 해제한다', async () => {
      repositories.subTask.findOne.mockResolvedValue(subTask([member()]));
      const result = await service.setSubTaskAssignee(50, {}, USER_ID);
      expect(manager.delete).toHaveBeenCalledWith(SubTaskAssignee, {
        subTaskId: 50,
      });
      expect(result.assignees).toEqual([]);
    });

    it('담당자가 그대로면 아무것도 바꾸지 않는다', async () => {
      repositories.subTask.findOne.mockResolvedValue(subTask([member()]));
      await service.setSubTaskAssignee(50, { assigneeIds: [USER_ID] }, USER_ID);
      expect(manager.delete).not.toHaveBeenCalled();
    });
  });

  describe('updateSubTaskDeadline', () => {
    beforeEach(() => {
      repositories.subTask.findOne.mockResolvedValue({
        id: 50,
        taskId: 10,
        title: '조사',
        status: SubTaskStatus.PENDING,
        isAlarm: true,
        endDate: DEADLINE,
        assignees: [
          { member: member() },
          { member: member({ id: 101, userId: 2 }) },
        ],
        task: task(),
      });
      repositories.member.exists.mockResolvedValue(true);
    });

    it('과제 마감일보다 늦으면 INVALID_DEADLINE', async () => {
      expect(
        await errorCodeOf(
          service.updateSubTaskDeadline(
            50,
            { endDate: new Date(DEADLINE.getTime() + 1) },
            USER_ID,
          ),
        ),
      ).toBe('INVALID_DEADLINE');
    });

    it('마감이 지난 과제면 TASK_DEADLINE_EXPIRED', async () => {
      repositories.subTask.findOne.mockResolvedValue({
        id: 50,
        taskId: 10,
        assignees: [],
        task: task({ deadline: PAST_DEADLINE }),
      });
      expect(
        await errorCodeOf(
          service.updateSubTaskDeadline(50, { endDate: DEADLINE }, USER_ID),
        ),
      ).toBe('TASK_DEADLINE_EXPIRED');
    });

    it('마감일을 지우면 마감일 없는 상태로 알림을 맞춘다', async () => {
      await service.updateSubTaskDeadline(50, { endDate: null }, USER_ID);
      expect(manager.update).toHaveBeenCalledWith(SubTask, 50, {
        endDate: null,
      });
      expect(alarmService.deleteSubTaskAlarms).toHaveBeenCalledWith(
        [50],
        manager,
      );
      expect(alarmService.createSubTaskAlarms).not.toHaveBeenCalled();
    });

    it('마감일을 바꾸면 알림 시각을 다시 계산하고, 알림이 없는 담당자에게 만든다', async () => {
      const endDate = new Date(DEADLINE.getTime() - 3600_000);
      await service.updateSubTaskDeadline(50, { endDate }, USER_ID);
      expect(alarmService.updateSubTaskAlarmDates).toHaveBeenCalledWith(
        50,
        endDate,
        manager,
      );
      expect(alarmService.createSubTaskAlarms).toHaveBeenCalledWith(
        50,
        manager,
      );
    });
  });

  describe('updateSubTasks', () => {
    beforeEach(() => givenAccessibleTask());

    it('이 과제의 세부 과제가 아니면 SUBTASK_NOT_FOUND (규칙 검사보다 먼저)', async () => {
      repositories.subTask.find.mockResolvedValue([]);
      expect(
        await errorCodeOf(
          service.updateSubTasks(
            10,
            { subTasks: [{ subTaskId: 999 }] },
            USER_ID,
          ),
        ),
      ).toBe('SUBTASK_NOT_FOUND');
    });

    it('수정할 값이 없는 항목이 있으면 DATA_NOT_PROVIDED', async () => {
      repositories.subTask.find.mockResolvedValue([{ id: 1, taskId: 10 }]);
      expect(
        await errorCodeOf(
          service.updateSubTasks(10, { subTasks: [{ subTaskId: 1 }] }, USER_ID),
        ),
      ).toBe('DATA_NOT_PROVIDED');
    });

    it('deadline만 보내도 endDate로 반영하고 알림 시각을 다시 계산한다', async () => {
      const endDate = new Date(DEADLINE.getTime() - 24 * 3600_000);
      repositories.subTask.find.mockResolvedValue([
        {
          id: 1,
          taskId: 10,
          title: '조사',
          isAlarm: true,
          assignees: [{ memberId: 100 }],
        },
      ]);
      repositories.member.find.mockResolvedValue([member()]);

      const result = await service.updateSubTasks(
        10,
        { subTasks: [{ subTaskId: 1, deadline: endDate }] },
        USER_ID,
      );

      expect(result).toEqual([
        { subTaskId: 1, title: '조사', deadline: endDate, isAlarm: true },
      ]);
      expect(manager.delete).not.toHaveBeenCalledWith(
        SubTaskAssignee,
        expect.anything(),
      );
      expect(alarmService.deleteSubTaskAlarms).toHaveBeenCalledWith(
        [1],
        manager,
        [],
      );
      expect(alarmService.updateSubTaskAlarmDates).toHaveBeenCalledWith(
        1,
        endDate,
        manager,
      );
      expect(alarmService.createSubTaskAlarms).toHaveBeenCalledWith(1, manager);
    });

    it('assigneeIds만 보내도 수정 요청으로 보고 담당자를 바꾼다', async () => {
      repositories.subTask.find.mockResolvedValue([
        { id: 1, taskId: 10, title: '조사', isAlarm: true, assignees: [] },
      ]);
      repositories.member.find.mockResolvedValue([member()]);

      await service.updateSubTasks(
        10,
        { subTasks: [{ subTaskId: 1, assigneeIds: [USER_ID] }] },
        USER_ID,
      );

      expect(manager.insert).toHaveBeenCalledWith(SubTaskAssignee, [
        { subTaskId: 1, memberId: 100 },
      ]);
      // 마감일이 없는 세부 과제라 알림은 만들지 않고 지운다
      expect(alarmService.deleteSubTaskAlarms).toHaveBeenCalledWith(
        [1],
        manager,
      );
      expect(alarmService.createSubTaskAlarms).not.toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    it('수정할 값이 없으면 DATA_NOT_PROVIDED', async () => {
      givenAccessibleTask();
      expect(await errorCodeOf(service.updateTask(10, {}, USER_ID))).toBe(
        'DATA_NOT_PROVIDED',
      );
    });

    it('마감일을 바꾸면 과제 알림 시각도 다시 계산한다', async () => {
      givenAccessibleTask();
      repositories.subTask.findOne.mockResolvedValue(null);
      const deadline = new Date('2026-10-25T00:00:00.000Z');

      await service.updateTask(10, { deadline }, USER_ID);

      expect(manager.update).toHaveBeenCalledWith(Task, 10, { deadline });
      expect(alarmService.updateTaskAlarmDates).toHaveBeenCalledWith(
        10,
        deadline,
        manager,
      );
    });
  });

  describe('convertTaskToTeam', () => {
    it('이미 팀 과제면 INVALID_TASK_TYPE', async () => {
      givenAccessibleTask({ type: TaskType.TEAM });
      expect(await errorCodeOf(service.convertTaskToTeam(10, USER_ID))).toBe(
        'INVALID_TASK_TYPE',
      );
    });
  });

  describe('deleteTeamMember', () => {
    it('대상이 없으면 권한 확인보다 먼저 MEMBER_NOT_FOUND', async () => {
      givenAccessibleTask({ type: TaskType.TEAM }, { role: true });
      repositories.member.findOne
        .mockResolvedValueOnce(member({ role: true }))
        .mockResolvedValueOnce(null);
      expect(await errorCodeOf(service.deleteTeamMember(10, 2, USER_ID))).toBe(
        'MEMBER_NOT_FOUND',
      );
    });

    it('소유자가 아니면 FORBIDDEN', async () => {
      givenAccessibleTask({ type: TaskType.TEAM }, { role: true });
      expect(await errorCodeOf(service.deleteTeamMember(10, 2, USER_ID))).toBe(
        'FORBIDDEN',
      );
    });
  });

  describe('deleteSubTasks', () => {
    it('요청한 과제의 세부 과제만 삭제한다', async () => {
      givenAccessibleTask();
      repositories.subTask.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteSubTasks(
        10,
        { subTaskIds: [1, 2] },
        USER_ID,
      );

      expect(repositories.subTask.delete).toHaveBeenCalledWith({
        id: expect.anything(),
        taskId: 10,
      });
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe('deleteTask', () => {
    it('소유자면 과제를 삭제한다 (나머지는 FK CASCADE)', async () => {
      givenAccessibleTask({ type: TaskType.TEAM });

      const result = await service.deleteTask(10, USER_ID);

      expect(repositories.task.delete).toHaveBeenCalledWith(10);
      expect(result).toEqual({ deleted: 'task', taskId: 10 });
    });

    it('팀원이면 담당을 해제하고 알림과 본인 참여만 지운다', async () => {
      givenAccessibleTask({ type: TaskType.TEAM }, { id: 101, role: true });

      const result = await service.deleteTask(10, USER_ID);

      expect(manager.delete).toHaveBeenCalledWith(SubTaskAssignee, {
        memberId: 101,
      });
      expect(alarmService.deleteAlarmsByUserAndTask).toHaveBeenCalledWith(
        USER_ID,
        10,
        manager,
      );
      expect(manager.delete).toHaveBeenCalledWith(Member, 101);
      expect(result).toMatchObject({ deleted: 'member', memberId: 101 });
    });
  });

  describe('generateInviteCode', () => {
    it('개인 과제면 FORBIDDEN_INVITE_CODE', async () => {
      givenAccessibleTask();
      expect(await errorCodeOf(service.generateInviteCode(10, USER_ID))).toBe(
        'FORBIDDEN_INVITE_CODE',
      );
    });

    it('유효한 코드가 있으면 새로 만들지 않는다', async () => {
      const expiredAt = new Date(Date.now() + 3600_000);
      givenAccessibleTask({
        type: TaskType.TEAM,
        inviteCode: 'ABCD1234',
        inviteExpiredAt: expiredAt,
      });
      expect(await service.generateInviteCode(10, USER_ID)).toEqual({
        invite_code: 'ABCD1234',
        invite_expired: expiredAt,
      });
      expect(repositories.task.update).not.toHaveBeenCalled();
    });

    it('코드가 없으면 대문자·숫자 8자리 코드를 하루 기한으로 만든다', async () => {
      givenAccessibleTask({ type: TaskType.TEAM });
      const result = await service.generateInviteCode(10, USER_ID);
      expect(result.invite_code).toMatch(/^[A-Z0-9]{8}$/);
      expect(result.invite_expired.getTime() - Date.now()).toBeGreaterThan(
        23 * 3600_000,
      );
    });
  });

  it('calculateProgressRate는 완료한 세부 과제 비율을 반올림한다', () => {
    expect(calculateProgressRate([])).toBe(0);
    expect(
      calculateProgressRate([
        { status: SubTaskStatus.COMPLETED },
        { status: SubTaskStatus.PENDING },
        { status: SubTaskStatus.PENDING },
      ]),
    ).toBe(33);
  });
});
