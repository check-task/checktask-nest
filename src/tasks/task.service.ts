import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';
import { AlarmService, AssignedSubTask } from '../alarms/alarm.service';
import { SubTaskStatus, TaskType } from '../common/enums';
import { OffsetPage, toOffsetPage } from '../common/pagination/pagination.dto';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../common/response/error/custom.error';
import { addDays } from '../common/utils/date.util';
import { FolderService } from '../folders/folder.service';
import { ReferenceService } from '../references/reference.service';
import { UserService } from '../users/user.service';
import { MEMBER_ROLE, Member } from './entities/member.entity';
import { SubTaskAssignee } from './entities/sub-task-assignee.entity';
import { SubTask } from './entities/sub-task.entity';
import { TaskPriority } from './entities/task-priority.entity';
import { Task } from './entities/task.entity';
import { TaskStatus } from './task-status.enum';
import {
  CompletedTaskResponseDto,
  ConvertTaskResponseDto,
  CreatedSubTaskResponseDto,
  CreateSubTaskDto,
  CreateTaskDto,
  DeletedAllSubTasksResponseDto,
  DeletedSubTasksResponseDto,
  DeleteSubTasksDto,
  GetCompletedTasksQueryDto,
  GetTasksQueryDto,
  InviteCodeResponseDto,
  JoinTaskDto,
  JoinTaskResponseDto,
  LeaveTaskResponseDto,
  MemberProfileResponseDto,
  MemberRoleResponseDto,
  RemovedMemberResponseDto,
  SetSubTaskAssigneeDto,
  SubTaskAssigneesResponseDto,
  AssigneeResponseDto,
  SubTaskDeadlineResponseDto,
  SubTaskStatusResponseDto,
  TASK_LIST_STATUS_IN_PROGRESS,
  TASK_SORT,
  TaskDeadlineResponseDto,
  TaskDetailResponseDto,
  TaskIdResponseDto,
  TaskListResponseDto,
  TaskMemberResponseDto,
  TaskMembersResponseDto,
  UpdatedSubTaskResponseDto,
  UpdateMemberRoleDto,
  UpdateSubTaskDeadlineDto,
  UpdateSubTasksDto,
  UpdateSubTaskStatusDto,
  UpdateTaskDeadlineDto,
  UpdateTaskDto,
  UpdateTaskPrioritiesDto,
} from './task.dto';

// 세부 과제 마감일 검사 문구 (레거시와 동일)
const SUB_TASK_DEADLINE_MESSAGES = {
  create: {
    invalid: '세부 과제의 마감일은 부모 과제의 마감일보다 늦을 수 없습니다.',
    expired: '이미 마감일이 지난 과제에는 세부 과제를 추가할 수 없습니다.',
  },
  update: {
    invalid: '세부 과제의 마감일은 부모 과제의 마감일보다 늦을 수 없습니다.',
    expired: '이미 마감일이 지난 과제의 세부 과제 마감일은 변경할 수 없습니다.',
  },
  updateDeadline: {
    invalid: '부모 Task의 마감일을 초과할 수 없습니다.',
    expired: '이미 마감일이 지난 과제의 세부 과제 마감일은 변경할 수 없습니다.',
  },
} as const;
type SubTaskDeadlineMessages =
  (typeof SUB_TASK_DEADLINE_MESSAGES)[keyof typeof SUB_TASK_DEADLINE_MESSAGES];

// assigneeId·assigneeIds를 합친 담당자 User.id 목록 (중복 제거)
const mergeAssigneeIds = (dto: {
  assigneeId?: number | null;
  assigneeIds?: number[];
}): number[] => [
  ...new Set([
    ...(dto.assigneeIds ?? []),
    ...(dto.assigneeId != null ? [dto.assigneeId] : []),
  ]),
];

// 담당자를 바꾸라는 요청인지 (둘 중 하나라도 보냈으면 통째로 바꾼다)
const isAssigneeChangeRequested = (dto: {
  assigneeId?: number | null;
  assigneeIds?: number[];
}): boolean => dto.assigneeId !== undefined || dto.assigneeIds !== undefined;

// 우선순위가 없는 과제는 맨 뒤로
const NO_PRIORITY_RANK = 999;
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const INVITE_CODE_TTL_DAYS = 1;

// 세부 과제 완료율 (0~100 정수)
export const calculateProgressRate = (
  subTasks: Pick<SubTask, 'status'>[],
): number => {
  if (subTasks.length === 0) return 0;
  const completed = subTasks.filter(
    (subTask) => subTask.status === SubTaskStatus.COMPLETED,
  ).length;
  return Math.round((completed / subTasks.length) * 100);
};

const createInviteCode = (): string =>
  Array.from(
    { length: INVITE_CODE_LENGTH },
    () => INVITE_CODE_CHARS[randomInt(INVITE_CODE_CHARS.length)],
  ).join('');

@Injectable()
export class TaskService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(SubTask)
    private readonly subTaskRepository: Repository<SubTask>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(TaskPriority)
    private readonly taskPriorityRepository: Repository<TaskPriority>,
    private readonly userService: UserService,
    private readonly folderService: FolderService,
    private readonly alarmService: AlarmService,
    private readonly referenceService: ReferenceService,
  ) {}

  /**
   * 완료(마감 지난) 과제 조회 — 마감일 최신순, 오프셋 페이지네이션
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   */
  async getCompletedTasks(
    query: GetCompletedTasksQueryDto,
    userId: number,
  ): Promise<OffsetPage<'tasks', CompletedTaskResponseDto>> {
    await this.userService.assertUserExists(userId);

    // 내 Member 행 기준으로 조회해 내 폴더 정보까지 한 번에 가져온다
    const [members, totalCount] = await this.memberRepository.findAndCount({
      where: {
        userId,
        ...(query.folderId && { folderId: In(query.folderId) }),
        task: { deadline: LessThan(new Date()) },
      },
      relations: { task: true, folder: true },
      select: {
        id: true,
        task: {
          id: true,
          title: true,
          deadline: true,
          type: true,
          status: true,
        },
        folder: { id: true, folderTitle: true, color: true },
      },
      order: { task: { deadline: 'DESC', id: 'DESC' } },
      skip: query.skip,
      take: query.size,
    });
    return toOffsetPage(
      members.map((member) =>
        CompletedTaskResponseDto.from(member.task, member.folder),
      ),
      totalCount,
      query,
      'tasks',
    );
  }

  /**
   * 과제 생성 (생성자는 소유자로 참여, 마감 알림 생성)
   * @throws NotFoundError(DEFAULT_FOLDER_NOT_FOUND | FOLDER_NOT_FOUND) - 폴더가 없을 때
   * @throws ForbiddenError(FORBIDDEN_FOLDER) - 다른 사용자의 폴더일 때
   * @throws BadRequestError(INVALID_DEADLINE) - 세부 과제 마감일이 과제 마감일보다 늦을 때
   */
  async createTask(
    dto: CreateTaskDto,
    userId: number,
  ): Promise<TaskIdResponseDto> {
    const folderId = await this.folderService.resolveFolderId(
      userId,
      dto.folderId,
    );
    for (const subTask of dto.subTasks) {
      this.assertSubTaskDeadline(
        subTask.endDate,
        dto.deadline,
        SUB_TASK_DEADLINE_MESSAGES.create,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.save(
        manager.create(Task, {
          title: dto.title,
          deadline: dto.deadline,
          type: dto.type,
          status: TaskStatus.PENDING,
          isAlarm: true,
        }),
      );
      const owner = await manager.save(
        manager.create(Member, {
          userId,
          taskId: task.id,
          role: MEMBER_ROLE.OWNER,
          folderId,
        }),
      );

      // 새 과제는 내 우선순위 맨 뒤에 둔다
      const maxRank =
        (await manager.maximum(TaskPriority, 'rank', { userId })) ?? 0;
      await manager.insert(TaskPriority, {
        userId,
        taskId: task.id,
        rank: maxRank + 1,
      });

      // 담당자 미지정: 개인 과제는 소유자, 팀 과제는 없음 (새 과제의 참여자는 소유자뿐)
      const assigneesBySubTask = dto.subTasks.map((subTask) =>
        this.resolveAssignees(task, [owner], mergeAssigneeIds(subTask), userId),
      );
      const subTasks =
        dto.subTasks.length > 0
          ? await manager.save(
              dto.subTasks.map((subTask) =>
                manager.create(SubTask, {
                  taskId: task.id,
                  title: subTask.title,
                  endDate: subTask.endDate ?? null,
                  status: SubTaskStatus.PENDING,
                  isAlarm: true,
                }),
              ),
            )
          : [];
      await this.insertAssignees(
        manager,
        subTasks.map((subTask, index) => ({
          subTaskId: subTask.id,
          members: assigneesBySubTask[index],
        })),
      );

      await this.alarmService.createTaskAlarms(manager, task, [userId], 0);
      await this.alarmService.createSubTaskAlarms(
        manager,
        subTasks.map((subTask, index) => ({
          subTask,
          assigneeUserIds: assigneesBySubTask[index].map(
            (member) => member.userId,
          ),
        })),
      );
      await this.referenceService.createForTask(
        manager,
        task.id,
        dto.references,
        dto.communications,
      );

      return { taskId: task.id };
    });
  }

  /**
   * 과제 우선순위 일괄 변경
   * @throws ForbiddenError(FORBIDDEN_TASK) - 참여하지 않은 과제가 포함됐을 때
   */
  async updateTaskPriorities(
    dto: UpdateTaskPrioritiesDto,
    userId: number,
  ): Promise<null> {
    // 같은 과제가 여러 번 오면 마지막 값을 쓴다 (한 upsert 안에서 같은 행을 두 번 바꿀 수 없음)
    const rankByTaskId = new Map(
      dto.orderedTasks.map(({ taskId, rank }) => [taskId, rank]),
    );
    const taskIds = [...rankByTaskId.keys()];

    const memberCount = await this.memberRepository.count({
      where: { userId, taskId: In(taskIds) },
    });
    if (memberCount !== taskIds.length) {
      throw new ForbiddenError(
        'FORBIDDEN_TASK',
        '해당 과제에 접근할 권한이 없습니다.',
      );
    }

    await this.taskPriorityRepository.upsert(
      taskIds.map((taskId) => ({
        userId,
        taskId,
        rank: rankByTaskId.get(taskId),
      })),
      ['userId', 'taskId'],
    );
    return null;
  }

  /**
   * 초대 코드로 팀 과제 참여 (기존 팀원에게 참여 알림, 참여자에게 마감 알림)
   * @throws NotFoundError(DEFAULT_FOLDER_NOT_FOUND | FOLDER_NOT_FOUND) - 폴더가 없을 때
   * @throws ForbiddenError(FORBIDDEN_FOLDER) - 다른 사용자의 폴더일 때
   * @throws NotFoundError(INVITE_CODE_NOT_FOUND) - 초대 코드에 맞는 팀 과제가 없을 때
   * @throws ForbiddenError(EXPIRED_INVITE_CODE) - 초대 코드가 만료됐을 때
   * @throws BadRequestError(DUPLICATE_MEMBER) - 이미 참여한 과제일 때
   */
  async joinTaskByInviteCode(
    dto: JoinTaskDto,
    userId: number,
  ): Promise<JoinTaskResponseDto> {
    const folderId = await this.folderService.resolveFolderId(
      userId,
      dto.folderId,
    );

    const task = await this.taskRepository.findOne({
      where: { inviteCode: dto.inviteCode, type: TaskType.TEAM },
    });
    if (!task) {
      throw new NotFoundError(
        'INVITE_CODE_NOT_FOUND',
        '유효하지 않은 초대 코드입니다.',
      );
    }
    if (task.inviteExpiredAt && new Date() > task.inviteExpiredAt) {
      throw new ForbiddenError(
        'EXPIRED_INVITE_CODE',
        '만료된 초대 코드입니다.',
      );
    }
    const alreadyMember = await this.memberRepository.exists({
      where: { taskId: task.id, userId },
    });
    if (alreadyMember) {
      throw new BadRequestError('DUPLICATE_MEMBER', '이미 팀 멤버입니다.');
    }

    return this.dataSource.transaction(async (manager) => {
      const member = await manager.save(
        manager.create(Member, {
          userId,
          taskId: task.id,
          role: MEMBER_ROLE.MEMBER,
          folderId,
        }),
      );

      const others = await manager.find(Member, {
        where: { taskId: task.id, userId: Not(userId) },
        select: { id: true, userId: true },
      });
      const nickname =
        (await this.userService.getNickname(userId, manager)) ?? '새로운 팀원';
      await this.alarmService.createMemberJoinAlarms(
        manager,
        task,
        others.map((other) => other.userId),
        nickname,
      );

      if (task.isAlarm) {
        const subTasks = await manager.find(SubTask, {
          where: { taskId: task.id },
          select: { id: true, status: true },
        });
        await this.alarmService.createTaskAlarms(
          manager,
          task,
          [userId],
          calculateProgressRate(subTasks),
        );
      }

      return {
        task_id: task.id,
        task_title: task.title,
        member_id: member.id,
        folderId,
      };
    });
  }

  /**
   * 세부 과제 완료 여부 변경
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 세부 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK) - 과제 참여자가 아닐 때
   */
  async updateSubTaskStatus(
    subTaskId: number,
    dto: UpdateSubTaskStatusDto,
    userId: number,
  ): Promise<SubTaskStatusResponseDto> {
    const subTask = await this.getAccessibleSubTask(subTaskId, userId);
    await this.subTaskRepository.update(subTask.id, { status: dto.status });
    return {
      sub_task_id: subTask.id,
      status: dto.status === SubTaskStatus.COMPLETED ? '완료' : '미완료',
    };
  }

  /**
   * 세부 과제 마감일 변경 (null이면 미지정, 알림도 함께 조정)
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 세부 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK) - 과제 참여자가 아닐 때
   * @throws BadRequestError(INVALID_DEADLINE) - 과제 마감일보다 늦을 때
   * @throws BadRequestError(TASK_DEADLINE_EXPIRED) - 마감일이 지난 과제일 때
   */
  async updateSubTaskDeadline(
    subTaskId: number,
    dto: UpdateSubTaskDeadlineDto,
    userId: number,
  ): Promise<SubTaskDeadlineResponseDto> {
    const subTask = await this.getAccessibleSubTask(subTaskId, userId, {
      task: true,
      assignees: { member: true },
    });
    const endDate = dto.endDate;
    this.assertSubTaskDeadline(
      endDate,
      subTask.task.deadline,
      SUB_TASK_DEADLINE_MESSAGES.updateDeadline,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.update(SubTask, subTask.id, { endDate });
      // 마감일이 없어지면 알림을 지우고, 생기거나 바뀌면 알림을 만들거나 시각을 고친다
      await this.alarmService.syncSubTaskAlarms(manager, [
        {
          subTask: { ...this.toAlarmSubTask(subTask), endDate },
          assigneeUserIds: subTask.assignees.map(
            (assignee) => assignee.member.userId,
          ),
        },
      ]);
    });
    return { sub_task_id: subTask.id, end_date: endDate };
  }

  /**
   * 세부 과제 담당자 지정 — assigneeId·assigneeIds(User.id)를 합친 목록으로 통째로 바꾼다. 비어 있으면 담당자 해제
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 세부 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK) - 과제 참여자가 아닐 때
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK) - 담당자가 과제 참여자가 아닐 때
   * @throws BadRequestError(ASSIGNEE_NOT_OWNER) - 개인 과제에서 소유자가 아닌 담당자를 지정할 때
   */
  async setSubTaskAssignee(
    subTaskId: number,
    dto: SetSubTaskAssigneeDto,
    userId: number,
  ): Promise<SubTaskAssigneesResponseDto> {
    const subTask = await this.getAccessibleSubTask(subTaskId, userId, {
      task: { members: { user: true } },
      assignees: true,
    });
    const nextAssignees = this.findAssignableMembers(
      subTask.task,
      subTask.task.members,
      mergeAssigneeIds(dto),
    );
    const response = {
      sub_task_id: subTask.id,
      assignees: nextAssignees.map((member) =>
        AssigneeResponseDto.from(member),
      ),
    };

    const prevMemberIds = new Set(
      subTask.assignees.map((assignee) => assignee.memberId),
    );
    const unchanged =
      prevMemberIds.size === nextAssignees.length &&
      nextAssignees.every((member) => prevMemberIds.has(member.id));
    if (unchanged) return response;

    await this.dataSource.transaction(async (manager) => {
      await this.replaceAssignees(manager, subTask.id, nextAssignees);
      await manager.update(SubTask, subTask.id, { updatedAt: new Date() });
      // 빠진 담당자의 알림은 지우고, 새 담당자에게 알림을 만든다
      await this.alarmService.syncSubTaskAlarms(manager, [
        {
          subTask: this.toAlarmSubTask(subTask),
          assigneeUserIds: nextAssignees.map((member) => member.userId),
        },
      ]);
    });
    return response;
  }

  /**
   * 과제 수정 (제목·마감일·내 폴더)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws BadRequestError(DATA_NOT_PROVIDED) - 수정할 값이 없을 때
   * @throws NotFoundError(DEFAULT_FOLDER_NOT_FOUND | FOLDER_NOT_FOUND) - 폴더가 없을 때
   * @throws ForbiddenError(FORBIDDEN_FOLDER) - 다른 사용자의 폴더일 때
   * @throws BadRequestError(INVALID_DEADLINE) - 세부 과제 마감일보다 이른 마감일일 때
   */
  async updateTask(
    taskId: number,
    dto: UpdateTaskDto,
    userId: number,
    type?: TaskType,
  ): Promise<TaskIdResponseDto> {
    await this.getAccessibleTask(taskId, userId, type);
    const { title, folderId, deadline } = dto;
    if (title === undefined && folderId === undefined && !deadline) {
      throw new BadRequestError(
        'DATA_NOT_PROVIDED',
        '수정할 데이터가 전달되지 않았습니다.',
      );
    }
    const targetFolderId =
      folderId === undefined
        ? undefined
        : await this.folderService.resolveFolderId(userId, folderId);
    if (deadline) await this.assertTaskDeadlineAfterSubTasks(taskId, deadline);

    await this.dataSource.transaction(async (manager) => {
      // 폴더는 참여자마다 다르므로 내 Member 행만 바꾼다
      if (targetFolderId !== undefined) {
        await manager.update(
          Member,
          { taskId, userId },
          { folderId: targetFolderId },
        );
      }
      if (title !== undefined || deadline) {
        await manager.update(Task, taskId, {
          ...(title !== undefined && { title }),
          ...(deadline && { deadline }),
        });
      }
      if (deadline)
        await this.alarmService.rescheduleTaskAlarms(manager, taskId, deadline);
    });
    return { taskId };
  }

  /**
   * 개인 과제 → 팀 과제 변경
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws BadRequestError(INVALID_TASK_TYPE) - 이미 팀 과제일 때
   */
  async convertTaskToTeam(
    taskId: number,
    userId: number,
  ): Promise<ConvertTaskResponseDto> {
    const { task } = await this.getAccessibleTask(taskId, userId);
    if (task.type === TaskType.TEAM) {
      throw new BadRequestError('INVALID_TASK_TYPE', '이미 팀 과제입니다.');
    }
    await this.taskRepository.update(taskId, { type: TaskType.TEAM });
    return { taskId, type: TaskType.TEAM };
  }

  /**
   * 과제 상세 조회
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   */
  async getTaskDetail(
    taskId: number,
    userId: number,
    type?: TaskType,
  ): Promise<TaskDetailResponseDto> {
    const { task, member } = await this.getAccessibleTask(taskId, userId, type);

    // 세부 과제 × 댓글 × 자료 × 회의록을 한 번에 JOIN하면 행이 곱으로 늘어나므로 나눠서 병렬 조회한다
    const [memberWithFolder, subTasks, { references, logs, communications }] =
      await Promise.all([
        this.memberRepository.findOne({
          where: { id: member.id },
          relations: { folder: true },
        }),
        this.subTaskRepository.find({
          where: { taskId },
          relations: {
            assignees: { member: { user: true } },
            comments: { user: true },
          },
          order: {
            endDate: { direction: 'ASC', nulls: 'LAST' },
            id: 'ASC',
            assignees: { id: 'ASC' },
            comments: { createdAt: 'ASC' },
          },
          withDeleted: true, // 탈퇴한 유저의 댓글·담당 표시 유지 (레거시와 동일)
        }),
        this.referenceService.findAllByTaskId(taskId),
      ]);

    // 완료된 세부 과제는 뒤로 (그룹 안에서는 마감일 순 유지 — 안정 정렬)
    const sortedSubTasks = [...subTasks].sort(
      (a, b) =>
        Number(a.status === SubTaskStatus.COMPLETED) -
        Number(b.status === SubTaskStatus.COMPLETED),
    );

    return TaskDetailResponseDto.from({
      task,
      folder: memberWithFolder?.folder ?? null,
      subTasks: sortedSubTasks,
      progressRate: calculateProgressRate(subTasks),
      references,
      logs,
      communications,
    });
  }

  /**
   * 과제 목록 조회 — 정렬: PRIORITY(기본) | DEADLINE | PROGRESSRATE, 오프셋 페이지네이션
   */
  async getTasks(
    query: GetTasksQueryDto,
    userId: number,
  ): Promise<TaskListResponseDto> {
    // 1) 필터·정렬을 DB에서 처리해 이번 페이지의 과제 ID만 가져온다
    const filtered = this.taskRepository
      .createQueryBuilder('task')
      // 내 Member 행·내 우선순위만 붙인다 (과제당 1행)
      .innerJoin('task.members', 'member', 'member.userId = :userId', {
        userId,
      })
      .leftJoin('task.priorities', 'priority', 'priority.userId = :userId', {
        userId,
      });
    if (query.folderId)
      filtered.andWhere('member.folderId = :folderId', {
        folderId: query.folderId,
      });
    if (query.type)
      filtered.andWhere('task.type = :type', { type: query.type });
    if (query.status === TASK_LIST_STATUS_IN_PROGRESS) {
      filtered.andWhere('task.deadline >= :now', { now: new Date() });
    }

    const [totalCount, idRows] = await Promise.all([
      filtered.getCount(),
      filtered
        .clone()
        .select('task.id', 'id')
        .addSelect(
          this.taskSortExpression(query.sort ?? TASK_SORT.PRIORITY),
          'sort_key',
        )
        .orderBy('sort_key', 'ASC')
        .addOrderBy('task.id', 'ASC')
        .offset(query.skip)
        .limit(query.size)
        .getRawMany<{ id: number }>(),
    ]);
    const ids = idRows.map((row) => row.id);
    if (ids.length === 0)
      return TaskListResponseDto.from([], totalCount, query);

    // 2) 이번 페이지 과제의 목록용 컬럼만 조회한다
    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .select([
        'task.id',
        'task.title',
        'task.deadline',
        'task.type',
        'task.status',
      ])
      .innerJoin('task.members', 'member', 'member.userId = :userId', {
        userId,
      })
      .addSelect(['member.id', 'member.folderId'])
      .leftJoin('member.folder', 'folder')
      .addSelect([
        'folder.id',
        'folder.folderTitle',
        'folder.color',
        'folder.rank',
      ])
      .leftJoin('task.subTasks', 'subTask')
      .addSelect([
        'subTask.id',
        'subTask.taskId',
        'subTask.title',
        'subTask.status',
        'subTask.endDate',
      ])
      .leftJoin('task.priorities', 'priority', 'priority.userId = :userId', {
        userId,
      })
      .addSelect(['priority.id', 'priority.rank'])
      .where('task.id IN (:...ids)', { ids })
      .orderBy('subTask.endDate', 'ASC', 'NULLS LAST')
      .addOrderBy('subTask.id', 'ASC')
      .getMany();

    // 1)에서 정한 순서대로 되돌린다
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const rows = ids
      .map((id) => taskById.get(id))
      .filter((task): task is Task => task !== undefined)
      .map((task) => ({
        task,
        folder: task.members[0]?.folder ?? null,
        priority: task.priorities[0]?.rank ?? null,
        progressRate: calculateProgressRate(task.subTasks),
      }));
    return TaskListResponseDto.from(rows, totalCount, query);
  }

  /**
   * 팀원 권한 변경 (0이면 대상이 소유자가 되고 나머지는 팀원이 된다)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws NotFoundError(MEMBER_NOT_FOUND) - 대상이 과제 참여자가 아닐 때
   * @throws ForbiddenError(FORBIDDEN) - 요청자가 소유자가 아닐 때
   */
  async updateMemberRole(
    taskId: number,
    targetUserId: number,
    dto: UpdateMemberRoleDto,
    userId: number,
    type?: TaskType,
  ): Promise<MemberRoleResponseDto> {
    const { member: requester } = await this.getAccessibleTask(
      taskId,
      userId,
      type,
    );
    const target = await this.memberRepository.findOne({
      where: { taskId, userId: targetUserId },
    });
    if (!target) {
      throw new NotFoundError(
        'MEMBER_NOT_FOUND',
        '해당 과제에서 해당 유저를 찾을 수 없음',
      );
    }
    if (requester.role !== MEMBER_ROLE.OWNER) {
      throw new ForbiddenError(
        'FORBIDDEN',
        '과제의 소유자(Owner)만 멤버 권한을 변경할 수 있습니다.',
      );
    }

    const role = dto.role === 0 ? MEMBER_ROLE.OWNER : MEMBER_ROLE.MEMBER;
    await this.dataSource.transaction(async (manager) => {
      // 소유자는 한 명만 둔다
      if (role === MEMBER_ROLE.OWNER) {
        await manager.update(
          Member,
          { taskId, userId: Not(targetUserId) },
          { role: MEMBER_ROLE.MEMBER },
        );
      }
      await manager.update(Member, target.id, { role });
    });
    return { memberId: userId, targetUserId, taskId, role };
  }

  /**
   * 팀원 추방 (소유자만)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws NotFoundError(MEMBER_NOT_FOUND) - 대상이 과제 참여자가 아닐 때
   * @throws ForbiddenError(FORBIDDEN) - 요청자가 소유자가 아닐 때
   */
  async deleteTeamMember(
    taskId: number,
    targetUserId: number,
    userId: number,
    type?: TaskType,
  ): Promise<RemovedMemberResponseDto> {
    const { member: requester } = await this.getAccessibleTask(
      taskId,
      userId,
      type,
    );
    const target = await this.memberRepository.findOne({
      where: { taskId, userId: targetUserId },
    });
    if (!target) {
      throw new NotFoundError('MEMBER_NOT_FOUND', '멤버를 찾을 수 없습니다.');
    }
    if (requester.role !== MEMBER_ROLE.OWNER) {
      throw new ForbiddenError(
        'FORBIDDEN',
        '권한이 없습니다. 팀장만 추방할 수 있습니다.',
      );
    }

    await this.dataSource.transaction((manager) =>
      this.removeMember(manager, target),
    );
    return { id: target.id, userId: target.userId, taskId: target.taskId };
  }

  /**
   * 세부 과제 1개 추가
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws BadRequestError(INVALID_DEADLINE) - 과제 마감일보다 늦을 때
   * @throws BadRequestError(TASK_DEADLINE_EXPIRED) - 마감일이 지난 과제일 때
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK | ASSIGNEE_NOT_OWNER) - 담당자로 지정할 수 없을 때
   */
  async createSubTask(
    taskId: number,
    dto: CreateSubTaskDto,
    userId: number,
    type?: TaskType,
  ): Promise<CreatedSubTaskResponseDto> {
    const { task } = await this.getAccessibleTask(taskId, userId, type);
    const endDate = dto.deadline ?? null;
    this.assertSubTaskDeadline(
      endDate,
      task.deadline,
      SUB_TASK_DEADLINE_MESSAGES.create,
    );

    const members = await this.memberRepository.find({ where: { taskId } });
    const assignees = this.resolveAssignees(
      task,
      members,
      mergeAssigneeIds(dto),
      userId,
    );

    return this.dataSource.transaction(async (manager) => {
      const subTask = await manager.save(
        manager.create(SubTask, {
          taskId,
          title: dto.title,
          endDate,
          status: SubTaskStatus.PENDING,
          isAlarm: dto.isAlarm ?? true,
        }),
      );
      await this.insertAssignees(manager, [
        { subTaskId: subTask.id, members: assignees },
      ]);
      await this.alarmService.createSubTaskAlarms(manager, [
        {
          subTask,
          assigneeUserIds: assignees.map((member) => member.userId),
        },
      ]);
      return {
        subTaskId: subTask.id,
        title: subTask.title,
        deadline: subTask.endDate,
      };
    });
  }

  /**
   * 세부 과제 여러 개 수정 (제목·마감일·알림 여부·담당자, 알림도 함께 조정)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 이 과제의 세부 과제가 아닐 때
   * @throws BadRequestError(DATA_NOT_PROVIDED) - 수정할 값이 없는 항목이 있을 때
   * @throws BadRequestError(INVALID_DEADLINE) - 과제 마감일보다 늦을 때
   * @throws BadRequestError(TASK_DEADLINE_EXPIRED) - 마감일이 지난 과제일 때
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK | ASSIGNEE_NOT_OWNER) - 담당자로 지정할 수 없을 때
   */
  async updateSubTasks(
    taskId: number,
    dto: UpdateSubTasksDto,
    userId: number,
    type?: TaskType,
  ): Promise<UpdatedSubTaskResponseDto[]> {
    const { task } = await this.getAccessibleTask(taskId, userId, type);

    // 존재 확인: 이 과제의 세부 과제만 수정할 수 있다
    const subTaskIds = [...new Set(dto.subTasks.map((item) => item.subTaskId))];
    const [subTasks, members] = await Promise.all([
      this.subTaskRepository.find({
        where: { id: In(subTaskIds), taskId },
        relations: { assignees: true },
      }),
      this.memberRepository.find({
        where: { taskId },
        select: { id: true, userId: true, role: true },
      }),
    ]);
    if (subTasks.length !== subTaskIds.length) {
      throw new NotFoundError(
        'SUBTASK_NOT_FOUND',
        '세부 과제가 존재하지 않습니다.',
      );
    }

    // 규칙 확인 후 변경 내용을 반영한다
    const subTaskById = new Map(
      subTasks.map((subTask) => [subTask.id, subTask]),
    );
    // 담당자를 바꿀 세부 과제 → 새 담당자 (같은 세부 과제가 여러 번 오면 마지막 값)
    const nextAssigneesBySubTaskId = new Map<number, Member[]>();
    for (const item of dto.subTasks) {
      // endDate가 없으면 deadline을 쓴다 (레거시 프론트 호환)
      const endDate = item.endDate !== undefined ? item.endDate : item.deadline;
      const assigneeChange = isAssigneeChangeRequested(item);
      if (
        item.title === undefined &&
        endDate === undefined &&
        item.isAlarm === undefined &&
        !assigneeChange
      ) {
        throw new BadRequestError('DATA_NOT_PROVIDED', '수정할 값이 없습니다.');
      }
      this.assertSubTaskDeadline(
        endDate,
        task.deadline,
        SUB_TASK_DEADLINE_MESSAGES.update,
      );
      if (assigneeChange) {
        nextAssigneesBySubTaskId.set(
          item.subTaskId,
          this.findAssignableMembers(task, members, mergeAssigneeIds(item)),
        );
      }

      const subTask = subTaskById.get(item.subTaskId);
      if (!subTask) continue;
      if (item.title !== undefined) subTask.title = item.title;
      if (endDate !== undefined) subTask.endDate = endDate;
      if (item.isAlarm !== undefined) subTask.isAlarm = item.isAlarm;
    }

    const userIdByMemberId = new Map(
      members.map((member) => [member.id, member.userId]),
    );
    // 담당자 변경이 없는 세부 과제는 기존 담당자 기준으로 알림을 맞춘다
    const assigneeUserIdsOf = (subTask: SubTask): number[] =>
      nextAssigneesBySubTaskId
        .get(subTask.id)
        ?.map((member) => member.userId) ??
      subTask.assignees
        .map((assignee) => userIdByMemberId.get(assignee.memberId))
        .filter((id): id is number => id !== undefined);

    await this.dataSource.transaction(async (manager) => {
      // assignees 관계는 저장 대상에서 빼고 컬럼만 저장한다 (담당자는 아래에서 따로 바꿈)
      await manager.save(
        SubTask,
        subTasks.map((subTask) =>
          manager.create(SubTask, {
            id: subTask.id,
            title: subTask.title,
            endDate: subTask.endDate,
            isAlarm: subTask.isAlarm,
          }),
        ),
      );
      for (const [subTaskId, nextMembers] of nextAssigneesBySubTaskId) {
        await this.replaceAssignees(manager, subTaskId, nextMembers);
      }
      await this.alarmService.syncSubTaskAlarms(
        manager,
        subTasks.map((subTask) => ({
          subTask: this.toAlarmSubTask(subTask),
          assigneeUserIds: assigneeUserIdsOf(subTask),
        })),
      );
    });
    return subTasks.map((subTask) => UpdatedSubTaskResponseDto.from(subTask));
  }

  /**
   * 과제의 세부 과제 전체 삭제 (알림·댓글은 FK CASCADE로 함께 삭제)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   */
  async deleteAllSubTasks(
    taskId: number,
    userId: number,
    type?: TaskType,
  ): Promise<DeletedAllSubTasksResponseDto> {
    await this.getAccessibleTask(taskId, userId, type);
    const subTasks = await this.subTaskRepository.find({
      where: { taskId },
      select: { id: true },
    });
    if (subTasks.length > 0) await this.subTaskRepository.delete({ taskId });
    return { deleted: subTasks.map((subTask) => subTask.id) };
  }

  /**
   * 선택한 세부 과제 삭제 (이 과제의 세부 과제만 삭제, 알림·댓글은 FK CASCADE)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   */
  async deleteSubTasks(
    taskId: number,
    dto: DeleteSubTasksDto,
    userId: number,
    type?: TaskType,
  ): Promise<DeletedSubTasksResponseDto> {
    await this.getAccessibleTask(taskId, userId, type);
    const result = await this.subTaskRepository.delete({
      id: In(dto.subTaskIds),
      taskId,
    });
    return { deletedCount: result.affected ?? 0 };
  }

  /**
   * 과제 마감일 변경 (마감 알림 시각도 다시 계산)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws BadRequestError(INVALID_DEADLINE) - 세부 과제 마감일보다 이를 때
   */
  async updateTaskDeadline(
    taskId: number,
    dto: UpdateTaskDeadlineDto,
    userId: number,
    type?: TaskType,
  ): Promise<TaskDeadlineResponseDto> {
    await this.getAccessibleTask(taskId, userId, type);
    await this.assertTaskDeadlineAfterSubTasks(taskId, dto.deadline);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Task, taskId, { deadline: dto.deadline });
      await this.alarmService.rescheduleTaskAlarms(
        manager,
        taskId,
        dto.deadline,
      );
    });
    return { taskId, deadline: dto.deadline };
  }

  /**
   * 팀 과제 초대 코드 발급 (유효한 코드가 있으면 그대로 반환)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH | FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws ForbiddenError(FORBIDDEN_INVITE_CODE) - 개인 과제일 때
   */
  async generateInviteCode(
    taskId: number,
    userId: number,
    type?: TaskType,
  ): Promise<InviteCodeResponseDto> {
    const { task } = await this.getAccessibleTask(taskId, userId, type);
    if (task.type === TaskType.PERSONAL) {
      throw new ForbiddenError(
        'FORBIDDEN_INVITE_CODE',
        '개인 과제는 초대 코드 생성이 불가능합니다.',
      );
    }
    if (
      task.inviteCode &&
      task.inviteExpiredAt &&
      task.inviteExpiredAt > new Date()
    ) {
      return {
        invite_code: task.inviteCode,
        invite_expired: task.inviteExpiredAt,
      };
    }

    const inviteCode = createInviteCode();
    const inviteExpiredAt = addDays(new Date(), INVITE_CODE_TTL_DAYS);
    await this.taskRepository.update(taskId, { inviteCode, inviteExpiredAt });
    return { invite_code: inviteCode, invite_expired: inviteExpiredAt };
  }

  /**
   * 과제 참여자 목록
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   */
  async getTaskMembers(
    taskId: number,
    userId: number,
  ): Promise<TaskMembersResponseDto> {
    await this.getAccessibleTask(taskId, userId);
    const members = await this.memberRepository.find({
      where: { taskId },
      relations: { user: true },
      select: {
        id: true,
        role: true,
        user: { id: true, nickname: true, profileImage: true },
      },
      order: { id: 'ASC' },
      withDeleted: true, // 탈퇴한 참여자도 목록에 유지 (레거시와 동일)
    });
    return {
      members: members.map((member) => TaskMemberResponseDto.from(member)),
      count: members.length,
    };
  }

  /**
   * 과제 삭제 또는 나가기 (소유자면 과제 전체 삭제, 팀원이면 본인만 나감)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   */
  async deleteTask(
    taskId: number,
    userId: number,
  ): Promise<LeaveTaskResponseDto> {
    const { member } = await this.getAccessibleTask(taskId, userId);

    if (member.role === MEMBER_ROLE.OWNER) {
      // 참여자·세부 과제·담당·알림·자료는 FK CASCADE로 함께 삭제된다
      await this.taskRepository.delete(taskId);
      return { deleted: 'task', taskId };
    }

    await this.dataSource.transaction((manager) =>
      this.removeMember(manager, member),
    );
    return {
      deleted: 'member',
      taskId,
      memberId: member.id,
      userId: member.userId,
    };
  }

  /**
   * 팀원 프로필 조회
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK | FORBIDDEN_PERSONAL_TASK) - 접근 권한이 없을 때
   * @throws NotFoundError(MEMBER_NOT_FOUND) - 대상이 과제 참여자가 아닐 때
   */
  async getMemberProfile(
    taskId: number,
    targetUserId: number,
    userId: number,
  ): Promise<MemberProfileResponseDto> {
    await this.getAccessibleTask(taskId, userId);
    const target = await this.memberRepository.findOne({
      where: { taskId, userId: targetUserId },
      relations: { user: true },
      select: {
        id: true,
        user: {
          id: true,
          nickname: true,
          phoneNum: true,
          email: true,
          profileImage: true,
        },
      },
      withDeleted: true,
    });
    if (!target) {
      throw new NotFoundError(
        'MEMBER_NOT_FOUND',
        '해당 팀원을 찾을 수 없습니다.',
      );
    }
    return MemberProfileResponseDto.from(target.user);
  }

  // ===== 권한 확인 =====

  /**
   * 과제 존재 → (type을 보냈으면) 종류 일치 → 참여자 → 개인 과제면 소유자 순으로 확인한다. (레거시 validateTaskType 미들웨어)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_TYPE_MISMATCH) - 화면(type)과 과제 종류가 다를 때
   * @throws ForbiddenError(FORBIDDEN_TASK) - 과제 참여자가 아닐 때
   * @throws ForbiddenError(FORBIDDEN_PERSONAL_TASK) - 다른 사용자의 개인 과제일 때
   */
  private async getAccessibleTask(
    taskId: number,
    userId: number,
    expectedType?: TaskType,
  ): Promise<{ task: Task; member: Member }> {
    const [task, member] = await Promise.all([
      this.taskRepository.findOne({ where: { id: taskId } }),
      this.memberRepository.findOne({ where: { taskId, userId } }),
    ]);
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', '존재하지 않는 과제입니다.');
    }
    if (expectedType && task.type !== expectedType) {
      throw new ForbiddenError(
        'TASK_TYPE_MISMATCH',
        expectedType === TaskType.PERSONAL
          ? '개인 과제만 접근할 수 있습니다.'
          : '팀 과제만 접근할 수 있습니다.',
      );
    }
    if (!member) {
      throw new ForbiddenError(
        'FORBIDDEN_TASK',
        '해당 과제에 접근할 권한이 없습니다.',
      );
    }
    if (task.type === TaskType.PERSONAL && member.role !== MEMBER_ROLE.OWNER) {
      throw new ForbiddenError(
        'FORBIDDEN_PERSONAL_TASK',
        '개인 과제는 소유자만 접근할 수 있습니다.',
      );
    }
    return { task, member };
  }

  /**
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 세부 과제가 없을 때
   * @throws ForbiddenError(FORBIDDEN_TASK) - 과제 참여자가 아닐 때
   */
  private async getAccessibleSubTask(
    subTaskId: number,
    userId: number,
    relations: Parameters<Repository<SubTask>['findOne']>[0]['relations'] = {},
  ): Promise<SubTask> {
    const subTask = await this.subTaskRepository.findOne({
      where: { id: subTaskId },
      relations,
      withDeleted: true, // 탈퇴한 참여자도 담당자로 표시 (레거시와 동일)
    });
    if (!subTask) {
      throw new NotFoundError(
        'SUBTASK_NOT_FOUND',
        '해당하는 세부 태스크를 찾을 수 없습니다.',
      );
    }
    const isMember = await this.memberRepository.exists({
      where: { taskId: subTask.taskId, userId },
    });
    if (!isMember) {
      throw new ForbiddenError(
        'FORBIDDEN_TASK',
        '해당 과제에 접근할 권한이 없습니다.',
      );
    }
    return subTask;
  }

  // ===== 비즈니스 규칙 =====

  /**
   * 세부 과제 마감일은 과제 마감일보다 늦을 수 없다.
   * @throws BadRequestError(TASK_DEADLINE_EXPIRED) - 과제 마감일이 이미 지났을 때
   * @throws BadRequestError(INVALID_DEADLINE) - 그 외에 과제 마감일보다 늦을 때
   */
  private assertSubTaskDeadline(
    endDate: Date | null | undefined,
    taskDeadline: Date,
    messages: SubTaskDeadlineMessages,
  ): void {
    if (!endDate || endDate <= taskDeadline) return;
    if (taskDeadline < new Date()) {
      throw new BadRequestError('TASK_DEADLINE_EXPIRED', messages.expired);
    }
    throw new BadRequestError('INVALID_DEADLINE', messages.invalid);
  }

  /**
   * @throws BadRequestError(INVALID_DEADLINE) - 가장 늦은 세부 과제 마감일보다 이를 때
   */
  private async assertTaskDeadlineAfterSubTasks(
    taskId: number,
    deadline: Date,
  ): Promise<void> {
    const latest = await this.subTaskRepository.findOne({
      where: { taskId, endDate: Not(IsNull()) },
      order: { endDate: 'DESC' },
      select: { id: true, endDate: true },
    });
    if (latest?.endDate && latest.endDate > deadline) {
      throw new BadRequestError(
        'INVALID_DEADLINE',
        '세부 과제의 마감일보다 이른 날짜로 변경할 수 없습니다.',
      );
    }
  }

  /**
   * 담당자로 지정할 Member를 찾는다. (assigneeUserId는 User.id)
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK) - 과제 참여자가 아닐 때
   * @throws BadRequestError(ASSIGNEE_NOT_OWNER) - 개인 과제에서 소유자가 아닐 때
   */
  private findAssignableMember(
    task: Pick<Task, 'type'>,
    members: Member[],
    assigneeUserId: number,
  ): Member {
    const assignee = members.find((member) => member.userId === assigneeUserId);
    if (!assignee) {
      throw new BadRequestError(
        'ASSIGNEE_NOT_IN_TASK',
        '해당 과제의 멤버만 담당자로 지정할 수 있습니다.',
      );
    }
    if (
      task.type === TaskType.PERSONAL &&
      assignee.role !== MEMBER_ROLE.OWNER
    ) {
      throw new BadRequestError(
        'ASSIGNEE_NOT_OWNER',
        '개인 과제는 과제 소유자(User)만 담당자로 지정할 수 있습니다.',
      );
    }
    return assignee;
  }

  /**
   * 담당자 User.id 목록 → Member 목록 (빈 목록이면 담당자 없음)
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK | ASSIGNEE_NOT_OWNER) - 담당자로 지정할 수 없을 때
   */
  private findAssignableMembers(
    task: Pick<Task, 'type'>,
    members: Member[],
    assigneeUserIds: number[],
  ): Member[] {
    return assigneeUserIds.map((assigneeUserId) =>
      this.findAssignableMember(task, members, assigneeUserId),
    );
  }

  /**
   * 생성할 세부 과제의 담당자. 지정하지 않으면 개인 과제는 요청자(소유자), 팀 과제는 없음
   * @throws BadRequestError(ASSIGNEE_NOT_IN_TASK | ASSIGNEE_NOT_OWNER) - 담당자로 지정할 수 없을 때
   */
  private resolveAssignees(
    task: Pick<Task, 'type'>,
    members: Member[],
    assigneeUserIds: number[],
    userId: number,
  ): Member[] {
    if (assigneeUserIds.length > 0) {
      return this.findAssignableMembers(task, members, assigneeUserIds);
    }
    return task.type === TaskType.PERSONAL
      ? members.filter((member) => member.userId === userId)
      : [];
  }

  /** 세부 과제 담당(SubTaskAssignee)을 한 번에 저장한다 */
  private async insertAssignees(
    manager: EntityManager,
    items: { subTaskId: number; members: Member[] }[],
  ): Promise<void> {
    const rows = items.flatMap(({ subTaskId, members }) =>
      members.map((member) => ({ subTaskId, memberId: member.id })),
    );
    if (rows.length > 0) await manager.insert(SubTaskAssignee, rows);
  }

  /** 세부 과제의 담당을 통째로 바꾼다 */
  private async replaceAssignees(
    manager: EntityManager,
    subTaskId: number,
    members: Member[],
  ): Promise<void> {
    await manager.delete(SubTaskAssignee, { subTaskId });
    await this.insertAssignees(manager, [{ subTaskId, members }]);
  }

  /** 목록 정렬 기준 SQL (작은 값이 위). 알 수 없는 정렬값은 생성순 */
  private taskSortExpression(sort: string): string {
    switch (sort) {
      case TASK_SORT.PRIORITY:
        return `COALESCE(priority.rank, ${NO_PRIORITY_RANK})`;
      case TASK_SORT.DEADLINE:
        return 'task.deadline';
      case TASK_SORT.PROGRESSRATE:
        // 세부 과제 완료율 (calculateProgressRate와 같은 계산)
        return `(SELECT COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE st.status = '${SubTaskStatus.COMPLETED}') / NULLIF(COUNT(*), 0)), 0) FROM "SubTask" st WHERE st.task_id = task.task_id)`;
      default:
        return 'task.id';
    }
  }

  /** 알림 계산에 필요한 세부 과제 필드 */
  private toAlarmSubTask(subTask: SubTask): AssignedSubTask['subTask'] {
    return {
      id: subTask.id,
      taskId: subTask.taskId,
      title: subTask.title,
      status: subTask.status,
      endDate: subTask.endDate,
      isAlarm: subTask.isAlarm,
    };
  }

  /** 참여자를 과제에서 뺀다 (담당 해제 → 알림 삭제 → Member 삭제) */
  private async removeMember(
    manager: EntityManager,
    member: Member,
  ): Promise<void> {
    await manager.delete(SubTaskAssignee, { memberId: member.id });
    await this.alarmService.deleteUserTaskAlarms(
      manager,
      member.userId,
      member.taskId,
    );
    await manager.delete(Member, member.id);
  }
}
