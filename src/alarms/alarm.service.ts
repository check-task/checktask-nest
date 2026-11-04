import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import { SubTaskStatus } from '../common/enums';
import { toCursorPage } from '../common/pagination/pagination.dto';
import { FcmService } from '../common/fcm/fcm.service';
import { RedisService } from '../common/redis/redis.service';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../common/response/error/custom.error';
import { addHours } from '../common/utils/date.util';
import { Member } from '../tasks/entities/member.entity';
import { SubTaskAssignee } from '../tasks/entities/sub-task-assignee.entity';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import {
  DEFAULT_ALARM_HOURS,
  UserAlarmSetting,
} from '../users/entities/user-alarm-setting.entity';
import { User } from '../users/entities/user.entity';
import { AlarmType } from './alarm-type.enum';
import {
  AlarmReadStatusResponseDto,
  AlarmResponseDto,
  DeadlineAlarmSettingResponseDto,
  GetAlarmsQueryDto,
  SubTaskAlarmStatusResponseDto,
  TaskAlarmSettingResponseDto,
  TaskAlarmStatusResponseDto,
  UnreadAlarmCountResponseDto,
} from './alarm.dto';
import { ALARM_TEXT_MAX_LENGTH, UserAlarm } from './alarm.entity';

// ===== Redis 키 =====

// 디바이스 FCM 토큰 (레거시와 같은 키·30일 보관)
export const fcmTokenKey = (userId: number) => `fcm_token:${userId}`;
export const FCM_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

// 이미 푸시를 보낸 알림 표시 (발송 대상 기간보다 길게 보관해 중복 발송을 막는다)
export const pushedAlarmKey = (alarmId: number) => `pushed_alarm:${alarmId}`;
export const PUSHED_ALARM_TTL_SECONDS = 60 * 60 * 24 * 2;

// 알림 시각이 지난 지 이 시간 안의 알림만 푸시한다. (오래된 안 읽은 알림이 계속 다시 발송되지 않게)
export const PUSH_WINDOW_HOURS = 24;

// ===== 알림 문구 =====

// 제목·내용 컬럼이 varchar(50)이라, 긴 이름은 잘라서 문구 전체가 50자를 넘지 않게 한다
const fitName = (name: string, fixedLength: number): string => {
  const room = ALARM_TEXT_MAX_LENGTH - fixedLength;
  return name.length > room ? `${name.slice(0, room - 1)}…` : name;
};

// 예: '중간 발표'의 마감까지 24시간 남았어요!
export const buildDeadlineTitle = (name: string, hours: number): string => {
  const suffix = `'의 마감까지 ${hours}시간 남았어요!`;
  return `'${fitName(name, suffix.length + 1)}${suffix}`;
};

// 과제 알림 내용 — 문구는 레거시와 동일 (앞의 ' 포함)
export const buildTaskProgressContent = (progress: number): string =>
  `'현재 ${progress}%완성 중이에요. 빨리 끝내고 쉬어요!`;

// 세부 과제 알림 내용 — 문구는 레거시와 동일
export const buildSubTaskStatusContent = (status: SubTaskStatus): string =>
  `'현재 ${status === SubTaskStatus.COMPLETED ? '완료' : '진행 중'} 상태에요. 빨리 끝내고 쉬어요!`;

export const MEMBER_JOIN_TITLE = '새로운 팀원이 참여했어요!';

// 예: 홍길동님이 '중간 발표'에 참여했습니다.
export const buildMemberJoinContent = (
  nickname: string,
  taskTitle: string,
): string => {
  const rest = `님이 '${taskTitle}'에 참여했습니다.`;
  return `${fitName(nickname, rest.length)}${rest}`;
};

// 커서 비교용 실제 컬럼명 (GetAlarmsQueryDto.orderBy → DB 컬럼)
const ORDER_COLUMN: Record<GetAlarmsQueryDto['orderBy'], string> = {
  alarmDate: 'alarm_date',
  createdAt: 'created_at',
};

interface TaskProgressRow {
  taskId: number;
  total: string;
  completed: string;
}

@Injectable()
export class AlarmService {
  private readonly logger = new Logger(AlarmService.name);

  constructor(
    @InjectRepository(UserAlarm)
    private readonly alarmRepository: Repository<UserAlarm>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(SubTask)
    private readonly subTaskRepository: Repository<SubTask>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly fcmService: FcmService,
  ) {}

  // ===================== API =====================

  /**
   * 알림 목록 조회 (커서). 알림 시각이 지난 알림만 보여 준다.
   * 커서는 마지막 alarmId이고, 정렬 기준(orderBy) 값이 같으면 alarmId로 순서를 정한다.
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   * @throws ForbiddenError(USER_DELETED) - 탈퇴한 사용자일 때
   */
  async getAlarms(userId: number, query: GetAlarmsQueryDto) {
    await this.findActiveUser(
      userId,
      '탈퇴한 유저는 알림을 조회할 수 없습니다.',
    );

    const { cursor, limit, orderBy, order, type } = query;
    const direction = order === 'asc' ? 'ASC' : 'DESC';
    const qb = this.alarmRepository
      .createQueryBuilder('alarm')
      .leftJoin('alarm.task', 'task')
      .addSelect(['task.id', 'task.type'])
      .where('alarm.userId = :userId', { userId })
      .andWhere('alarm.alarmDate <= :now', { now: new Date() })
      .orderBy(`alarm.${orderBy}`, direction)
      .addOrderBy('alarm.id', direction)
      .limit(limit + 1);

    if (type) qb.andWhere('alarm.type = :type', { type });

    if (cursor) {
      // (정렬 값, id)가 커서 알림보다 뒤인 것만 조회한다. 커서 알림이 없으면 결과도 비어 있다.
      const column = ORDER_COLUMN[orderBy];
      const operator = direction === 'DESC' ? '<' : '>';
      qb.andWhere(
        `(alarm.${column}, alarm.alarm_id) ${operator} (SELECT c.${column}, c.alarm_id FROM "UserAlarm" c WHERE c.alarm_id = :cursor AND c.user_id = :userId)`,
        { cursor },
      );
    }

    const alarms = await qb.getMany();

    // 과제 알림은 현재 진척도로 내용을 바꿔서 보여 준다 (레거시 동일)
    const taskIds = alarms
      .filter((alarm) => alarm.type === AlarmType.TASK && alarm.taskId)
      .map((alarm) => alarm.taskId as number);
    const progressMap = await this.getTaskProgress(taskIds);

    const rows = alarms.map((alarm) => {
      const progress =
        alarm.type === AlarmType.TASK && alarm.taskId
          ? progressMap.get(alarm.taskId)
          : undefined;
      const content =
        progress === undefined
          ? alarm.alarmContent
          : buildTaskProgressContent(progress);
      return AlarmResponseDto.from(alarm, content);
    });

    return toCursorPage(rows, limit, 'alarmList', (row) => row.alarmId);
  }

  /**
   * 안 읽은 알림 개수 조회 (알림 시각이 지난 알림만)
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   * @throws ForbiddenError(USER_DELETED) - 탈퇴한 사용자일 때
   */
  async getUnreadAlarmCount(
    userId: number,
  ): Promise<UnreadAlarmCountResponseDto> {
    await this.findActiveUser(
      userId,
      '탈퇴한 유저는 알림을 조회할 수 없습니다.',
    );
    const count = await this.alarmRepository.count({
      where: { userId, isRead: false, alarmDate: LessThanOrEqual(new Date()) },
    });
    return UnreadAlarmCountResponseDto.from(count);
  }

  // 알림 전체 삭제
  async deleteAllAlarms(userId: number): Promise<null> {
    await this.alarmRepository.delete({ userId });
    return null;
  }

  /**
   * 모든 알림 읽음 처리. 아직 보내지 않은(알림 시각 전) 알림은 그대로 둔다.
   * (레거시는 미래 알림까지 읽음 처리해 푸시가 나가지 않았음)
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   * @throws ForbiddenError(USER_DELETED) - 탈퇴한 사용자일 때
   */
  async updateAllAlarmReadStatus(userId: number): Promise<null> {
    await this.findActiveUser(userId, '탈퇴한 유저는 알림을 읽을 수 없습니다.');
    await this.alarmRepository.update(
      { userId, isRead: false, alarmDate: LessThanOrEqual(new Date()) },
      { isRead: true },
    );
    return null;
  }

  /**
   * 과제 마감 알림 시간(N시간 전) 변경. 마감 전인 과제 알림의 시각·제목도 다시 계산한다.
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   */
  async updateDeadlineAlarm(
    userId: number,
    deadlineAlarm: number,
  ): Promise<DeadlineAlarmSettingResponseDto> {
    const user = await this.findUser(userId);

    const alarmIds = await this.dataSource.transaction(async (manager) => {
      await manager.upsert(UserAlarmSetting, { userId, deadlineAlarm }, [
        'userId',
      ]);
      const alarms = await manager.find(UserAlarm, {
        where: {
          userId,
          type: AlarmType.TASK,
          task: { deadline: MoreThan(new Date()) },
        },
        relations: { task: true },
      });
      const updated = alarms.map((alarm) => {
        const task = alarm.task as Task;
        return manager.create(UserAlarm, {
          id: alarm.id,
          title: buildDeadlineTitle(task.title, deadlineAlarm),
          alarmDate: addHours(task.deadline, -deadlineAlarm),
          isRead: false,
        });
      });
      await manager.save(UserAlarm, updated);
      return updated.map((alarm) => alarm.id);
    });

    await this.clearPushed(alarmIds);
    return DeadlineAlarmSettingResponseDto.from(user, deadlineAlarm);
  }

  /**
   * 세부 과제 마감 알림 시간(N시간 전) 변경. 마감 전인 세부 과제 알림의 시각·제목도 다시 계산한다.
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   */
  async updateTaskAlarm(
    userId: number,
    taskAlarm: number,
  ): Promise<TaskAlarmSettingResponseDto> {
    const user = await this.findUser(userId);

    const alarmIds = await this.dataSource.transaction(async (manager) => {
      await manager.upsert(UserAlarmSetting, { userId, taskAlarm }, ['userId']);
      const alarms = await manager.find(UserAlarm, {
        where: {
          userId,
          type: AlarmType.SUBTASK,
          subTask: { endDate: MoreThan(new Date()) },
        },
        relations: { subTask: true },
      });
      const updated = alarms.map((alarm) => {
        const subTask = alarm.subTask as SubTask;
        return manager.create(UserAlarm, {
          id: alarm.id,
          title: buildDeadlineTitle(subTask.title, taskAlarm),
          alarmDate: addHours(subTask.endDate as Date, -taskAlarm),
          isRead: false,
        });
      });
      await manager.save(UserAlarm, updated);
      return updated.map((alarm) => alarm.id);
    });

    await this.clearPushed(alarmIds);
    return TaskAlarmSettingResponseDto.from(user, taskAlarm);
  }

  /**
   * 세부 과제 알림 켜기/끄기. 켜면 담당자별 알림을 만들고, 끄면 아직 보내지 않은 알림을 지운다.
   * @throws NotFoundError(SUBTASK_NOT_FOUND) - 세부 과제가 없을 때
   * @throws ForbiddenError(SUBTASK_ACCESS_DENIED) - 과제 참여자가 아닐 때
   * @throws BadRequestError(SUBTASK_NO_ASSIGNEE) - 담당자 없는 세부 과제의 알림을 켤 때
   */
  async updateSubTaskAlarmStatus(
    userId: number,
    subTaskId: number,
    isAlarm: boolean,
  ): Promise<SubTaskAlarmStatusResponseDto> {
    const subTask = await this.subTaskRepository.findOne({
      where: { id: subTaskId },
    });
    if (!subTask) {
      throw new NotFoundError(
        'SUBTASK_NOT_FOUND',
        '요청하신 subTaskId가 DB에 존재하지 않습니다.',
      );
    }
    await this.assertTaskMember(
      subTask.taskId,
      userId,
      'SUBTASK_ACCESS_DENIED',
      '해당 세부과제에 접근할 권한이 없습니다.',
    );

    if (isAlarm) {
      const hasAssignee = await this.dataSource
        .getRepository(SubTaskAssignee)
        .existsBy({ subTaskId });
      if (!hasAssignee) {
        throw new BadRequestError(
          'SUBTASK_NO_ASSIGNEE',
          '담당자가 지정된 세부과제만 알림을 켤 수 있습니다.',
        );
      }
    }

    // 값이 그대로면 알림을 다시 만들지 않는다
    if (subTask.isAlarm === isAlarm) {
      return SubTaskAlarmStatusResponseDto.from(subTask);
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.update(SubTask, { id: subTaskId }, { isAlarm });
      if (isAlarm) await this.createSubTaskAlarms(subTaskId, manager);
      else await this.deletePendingSubTaskAlarms(subTaskId, manager);
      return manager.findOneByOrFail(SubTask, { id: subTaskId });
    });
    return SubTaskAlarmStatusResponseDto.from(updated);
  }

  /**
   * 과제 알림 켜기/끄기. 켜면 참여자별 알림을 만들고, 끄면 아직 보내지 않은 알림을 지운다.
   * (레거시는 값만 바꾸고 알림은 그대로 발송했음)
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws ForbiddenError(TASK_ACCESS_DENIED) - 과제 참여자가 아닐 때
   */
  async updateTaskAlarmStatus(
    userId: number,
    taskId: number,
    isAlarm: boolean,
  ): Promise<TaskAlarmStatusResponseDto> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundError('TASK_NOT_FOUND', '과제를 찾을 수 없습니다.');
    }
    await this.assertTaskMember(
      taskId,
      userId,
      'TASK_ACCESS_DENIED',
      '해당 과제에 접근할 권한이 없습니다.',
    );

    // 값이 그대로면 알림을 다시 만들지 않는다
    if (task.isAlarm === isAlarm) return TaskAlarmStatusResponseDto.from(task);

    const updated = await this.dataSource.transaction(async (manager) => {
      await manager.update(Task, { id: taskId }, { isAlarm });
      if (isAlarm) await this.createTaskAlarms(taskId, manager);
      else await this.deletePendingTaskAlarms(taskId, manager);
      return manager.findOneByOrFail(Task, { id: taskId });
    });
    return TaskAlarmStatusResponseDto.from(updated);
  }

  /**
   * 개별 알림 삭제
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   * @throws ForbiddenError(USER_DELETED) - 탈퇴한 사용자일 때
   * @throws NotFoundError(ALARM_NOT_FOUND) - 알림이 없을 때
   * @throws ForbiddenError(ALARM_ACCESS_DENIED) - 다른 사용자의 알림일 때
   */
  async deleteAlarm(userId: number, alarmId: number): Promise<null> {
    await this.findActiveUser(
      userId,
      '탈퇴한 유저는 알림을 삭제할 수 없습니다.',
    );
    await this.findOwnAlarm(
      userId,
      alarmId,
      '요청하신 alarmID가 DB에 존재하지 않습니다.',
    );
    await this.alarmRepository.delete({ id: alarmId });
    return null;
  }

  /**
   * 알림 읽음 처리
   * @throws NotFoundError(ALARM_NOT_FOUND) - 알림이 없을 때
   * @throws ForbiddenError(ALARM_ACCESS_DENIED) - 다른 사용자의 알림일 때
   */
  async updateAlarmReadStatus(
    userId: number,
    alarmId: number,
    isRead: boolean,
  ): Promise<AlarmReadStatusResponseDto> {
    const alarm = await this.findOwnAlarm(
      userId,
      alarmId,
      '알림을 찾을 수 없습니다.',
    );
    await this.alarmRepository.update({ id: alarmId }, { isRead });
    alarm.isRead = isRead;
    return AlarmReadStatusResponseDto.from(alarm);
  }

  // 디바이스 FCM 토큰 등록 (레거시와 같이 Redis에 30일 보관, 다시 등록하면 갱신)
  async registerDevice(userId: number, fcmToken: string): Promise<null> {
    await this.redisService.set(
      fcmTokenKey(userId),
      fcmToken,
      FCM_TOKEN_TTL_SECONDS,
    );
    return null;
  }

  /**
   * 테스트 푸시 즉시 발송. 내 디바이스 토큰으로 바로 보낸다. (알림 DB에는 저장하지 않음)
   * @throws NotFoundError(FCM_TOKEN_NOT_FOUND) - 등록된 토큰이 없거나 만료된 토큰일 때
   * @throws InternalServerError(PUSH_SEND_FAILED) - FCM 발송 실패
   */
  async sendTestPush(
    userId: number,
    title: string,
    body: string,
  ): Promise<null> {
    const token = await this.redisService.get(fcmTokenKey(userId));
    if (!token) {
      throw new NotFoundError(
        'FCM_TOKEN_NOT_FOUND',
        '등록된 디바이스 토큰이 없습니다.',
      );
    }

    const result = await this.fcmService.send(token, title, body);
    if (result === 'INVALID_TOKEN') {
      // 만료된 토큰은 지우고, 앱에서 다시 등록하도록 안내한다
      await this.redisService.del(fcmTokenKey(userId));
      throw new NotFoundError(
        'FCM_TOKEN_NOT_FOUND',
        '디바이스 토큰이 만료되었습니다. 다시 등록해 주세요.',
      );
    }
    if (result === 'FAILED') {
      throw new InternalServerError(
        'PUSH_SEND_FAILED',
        '푸시 알림 발송에 실패했습니다.',
      );
    }
    return null;
  }

  // ===================== cron (alarm.scheduler.ts에서 호출) =====================

  /**
   * 알림 시각이 된 안 읽은 알림을 푸시로 보낸다.
   * - 알림 시각이 PUSH_WINDOW_HOURS 안인 알림만 보낸다. (오래된 알림이 계속 다시 발송되지 않게)
   * - 보낸 알림은 pushed_alarm 키로 표시해 다음 실행에서 다시 보내지 않는다.
   * - 토큰이 없는 사용자는 건너뛰고, 만료된 토큰은 지운다.
   */
  async sendDueAlarms(): Promise<void> {
    const now = new Date();
    const alarms = await this.alarmRepository.find({
      select: { id: true, userId: true, title: true, alarmContent: true },
      where: {
        isRead: false,
        alarmDate: Between(addHours(now, -PUSH_WINDOW_HOURS), now),
      },
      order: { alarmDate: 'ASC' },
    });
    if (alarms.length === 0) return;

    const pushed = await Promise.all(
      alarms.map((alarm) => this.redisService.get(pushedAlarmKey(alarm.id))),
    );
    const targets = alarms.filter((_, index) => !pushed[index]);

    const userIds = [...new Set(targets.map((alarm) => alarm.userId))];
    const tokens = await Promise.all(
      userIds.map((id) => this.redisService.get(fcmTokenKey(id))),
    );
    const tokenMap = new Map(userIds.map((id, index) => [id, tokens[index]]));

    const results = await Promise.all(
      targets.map(async (alarm) => {
        const token = tokenMap.get(alarm.userId);
        if (!token) return 'NO_TOKEN';
        const result = await this.fcmService.send(
          token,
          alarm.title,
          alarm.alarmContent,
        );
        if (result === 'SENT') {
          await this.redisService.set(
            pushedAlarmKey(alarm.id),
            '1',
            PUSHED_ALARM_TTL_SECONDS,
          );
        }
        if (result === 'INVALID_TOKEN') {
          await this.redisService.del(fcmTokenKey(alarm.userId));
        }
        return result;
      }),
    );

    const sent = results.filter((result) => result === 'SENT').length;
    this.logger.log(`마감 알림 발송: 대상 ${targets.length}건, 성공 ${sent}건`);
  }

  // ===================== 다른 도메인(tasks 등)에서 호출 =====================
  // 과제·세부 과제를 만들거나 바꿀 때 같은 트랜잭션의 manager를 넘겨 호출한다.

  /**
   * 과제 마감 알림 생성. 참여자마다 각자의 마감 알림 설정(deadlineAlarm)으로 시각을 계산한다.
   * - 과제 알림이 꺼져 있거나 마감이 지났으면 만들지 않는다.
   * - 이미 과제 알림이 있는 사용자는 건너뛴다. (여러 번 호출해도 중복되지 않음)
   * @param userIds 알림을 만들 사용자 (생략하면 과제 참여자 전원)
   */
  async createTaskAlarms(
    taskId: number,
    manager: EntityManager = this.dataSource.manager,
    userIds?: number[],
  ): Promise<void> {
    if (userIds?.length === 0) return;
    const task = await manager.findOneBy(Task, { id: taskId });
    if (!task || !task.isAlarm || task.deadline <= new Date()) return;

    const members = await manager.find(Member, {
      select: { userId: true },
      where: { taskId, ...(userIds && { userId: In(userIds) }) },
    });
    const targetIds = await this.excludeUsersWithAlarm(
      members.map((member) => member.userId),
      { taskId, type: AlarmType.TASK, subTaskId: IsNull() },
      manager,
    );
    if (targetIds.length === 0) return;

    const [hoursMap, progressMap] = await Promise.all([
      this.getAlarmHours(targetIds, 'deadlineAlarm', manager),
      this.getTaskProgress([taskId], manager),
    ]);
    const content = buildTaskProgressContent(progressMap.get(taskId) ?? 0);
    const alarms = targetIds.map((id) => {
      const hours = hoursMap.get(id) ?? DEFAULT_ALARM_HOURS;
      return manager.create(UserAlarm, {
        userId: id,
        taskId,
        type: AlarmType.TASK,
        title: buildDeadlineTitle(task.title, hours),
        alarmContent: content,
        alarmDate: addHours(task.deadline, -hours),
        isRead: false,
      });
    });
    await manager.save(UserAlarm, alarms);
  }

  /**
   * 세부 과제 마감 알림 생성. 담당자마다 각자의 세부 과제 알림 설정(taskAlarm)으로 시각을 계산한다.
   * - 세부 과제 알림이 꺼져 있거나 마감일이 없거나 지났으면 만들지 않는다.
   * - 이미 이 세부 과제의 알림이 있는 담당자는 건너뛴다.
   */
  async createSubTaskAlarms(
    subTaskId: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const subTask = await manager.findOneBy(SubTask, { id: subTaskId });
    if (
      !subTask ||
      !subTask.isAlarm ||
      !subTask.endDate ||
      subTask.endDate <= new Date()
    ) {
      return;
    }
    const endDate = subTask.endDate;

    const assignees = await manager.find(SubTaskAssignee, {
      where: { subTaskId },
      relations: { member: true },
    });
    const assigneeIds = assignees
      .map((assignee) => assignee.member?.userId)
      .filter((id): id is number => id !== undefined);
    const targetIds = await this.excludeUsersWithAlarm(
      assigneeIds,
      { subTaskId },
      manager,
    );
    if (targetIds.length === 0) return;

    const hoursMap = await this.getAlarmHours(targetIds, 'taskAlarm', manager);
    const alarms = targetIds.map((id) => {
      const hours = hoursMap.get(id) ?? DEFAULT_ALARM_HOURS;
      return manager.create(UserAlarm, {
        userId: id,
        taskId: subTask.taskId,
        subTaskId,
        type: AlarmType.SUBTASK,
        title: buildDeadlineTitle(subTask.title, hours),
        alarmContent: buildSubTaskStatusContent(subTask.status),
        alarmDate: addHours(endDate, -hours),
        isRead: false,
      });
    });
    await manager.save(UserAlarm, alarms);
  }

  // 과제 마감일이 바뀌었을 때 과제 알림 시각을 다시 계산한다 (레거시 updateAlarmsForTaskDeadline)
  async updateTaskAlarmDates(
    taskId: number,
    deadline: Date,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const alarms = await manager.find(UserAlarm, {
      select: { id: true, userId: true },
      where: { taskId, type: AlarmType.TASK },
    });
    await this.rescheduleAlarms(alarms, deadline, 'deadlineAlarm', manager);
  }

  // 세부 과제 마감일이 바뀌었을 때 알림 시각을 다시 계산한다 (레거시 updateAlarmsForSubTaskDeadline)
  async updateSubTaskAlarmDates(
    subTaskId: number,
    endDate: Date,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const alarms = await manager.find(UserAlarm, {
      select: { id: true, userId: true },
      where: { subTaskId },
    });
    await this.rescheduleAlarms(alarms, endDate, 'taskAlarm', manager);
  }

  /**
   * 세부 과제 알림 삭제 (담당자 변경·마감일 삭제 시, 레거시 deleteAlarmsBySubTaskIds·deleteSubTaskAlarm)
   * @param userIds 이 사용자들의 알림만 지운다 (생략하면 전원)
   */
  async deleteSubTaskAlarms(
    subTaskIds: number[],
    manager: EntityManager = this.dataSource.manager,
    userIds?: number[],
  ): Promise<void> {
    if (subTaskIds.length === 0 || userIds?.length === 0) return;
    await manager.delete(UserAlarm, {
      subTaskId: In(subTaskIds),
      ...(userIds && { userId: In(userIds) }),
    });
  }

  // 과제에서 나간 사용자의 해당 과제 알림 삭제 (레거시 deleteAlarmsByUserIdAndTaskId)
  async deleteAlarmsByUserAndTask(
    userId: number,
    taskId: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    await manager.delete(UserAlarm, { userId, taskId });
  }

  /**
   * 팀원 참여 알림 생성. 새 팀원을 뺀 기존 참여자에게 알림을 만들고, 다음 cron(5분 이내)에 푸시된다.
   * 새 팀원 본인의 과제 마감 알림은 createTaskAlarms(taskId, manager, [userId])로 만든다.
   */
  async createMemberJoinAlarms(
    taskId: number,
    joinedUserId: number,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<void> {
    const [task, joinedUser, members] = await Promise.all([
      manager.findOneBy(Task, { id: taskId }),
      manager.findOneBy(User, { id: joinedUserId }),
      manager.find(Member, { select: { userId: true }, where: { taskId } }),
    ]);
    if (!task) return;

    const content = buildMemberJoinContent(
      joinedUser?.nickname ?? '새로운 팀원',
      task.title,
    );
    const now = new Date();
    const alarms = members
      .filter((member) => member.userId !== joinedUserId)
      .map((member) =>
        manager.create(UserAlarm, {
          userId: member.userId,
          taskId,
          type: AlarmType.MEMBER,
          title: MEMBER_JOIN_TITLE,
          alarmContent: content,
          alarmDate: now,
          isRead: false,
        }),
      );
    if (alarms.length > 0) await manager.save(UserAlarm, alarms);
  }

  // ===================== 내부 =====================

  // 사용자 존재 확인 (탈퇴 여부와 무관)
  private async findUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundError('USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    }
    return user;
  }

  // 사용자 존재 확인 → 탈퇴 여부 확인
  private async findActiveUser(
    userId: number,
    deletedReason: string,
  ): Promise<User> {
    const user = await this.findUser(userId);
    if (user.deletedAt) throw new ForbiddenError('USER_DELETED', deletedReason);
    return user;
  }

  // 알림 존재 확인 → 본인 알림인지 확인
  private async findOwnAlarm(
    userId: number,
    alarmId: number,
    notFoundReason: string,
  ): Promise<UserAlarm> {
    const alarm = await this.alarmRepository.findOne({
      where: { id: alarmId },
    });
    if (!alarm) throw new NotFoundError('ALARM_NOT_FOUND', notFoundReason);
    if (alarm.userId !== userId) {
      throw new ForbiddenError(
        'ALARM_ACCESS_DENIED',
        '해당 알림에 접근할 권한이 없습니다.',
      );
    }
    return alarm;
  }

  // 과제 참여자(owner 포함)인지 확인. 에러 코드는 레거시대로 과제/세부 과제를 구분한다
  private async assertTaskMember(
    taskId: number,
    userId: number,
    errorCode: 'TASK_ACCESS_DENIED' | 'SUBTASK_ACCESS_DENIED',
    reason: string,
  ): Promise<void> {
    const isMember = await this.memberRepository.existsBy({ taskId, userId });
    if (!isMember) throw new ForbiddenError(errorCode, reason);
  }

  // 과제별 진척도(%) — 완료된 세부 과제 수 / 전체 세부 과제 수 (세부 과제가 없으면 0)
  private async getTaskProgress(
    taskIds: number[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<number, number>> {
    const progress = new Map<number, number>(taskIds.map((id) => [id, 0]));
    if (taskIds.length === 0) return progress;

    const rows = await manager
      .getRepository(SubTask)
      .createQueryBuilder('st')
      .select('st.taskId', 'taskId')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE st.status = :completed)', 'completed')
      .where('st.taskId IN (:...taskIds)', { taskIds: [...new Set(taskIds)] })
      .setParameter('completed', SubTaskStatus.COMPLETED)
      .groupBy('st.taskId')
      .getRawMany<TaskProgressRow>();

    for (const row of rows) {
      const total = Number(row.total);
      const completed = Number(row.completed);
      progress.set(
        Number(row.taskId),
        total > 0 ? Math.round((completed / total) * 100) : 0,
      );
    }
    return progress;
  }

  // 사용자별 알림 시간 설정 (설정이 없는 사용자는 Map에 없음 → 기본 24시간)
  private async getAlarmHours(
    userIds: number[],
    field: 'deadlineAlarm' | 'taskAlarm',
    manager: EntityManager,
  ): Promise<Map<number, number>> {
    if (userIds.length === 0) return new Map();
    const settings = await manager.find(UserAlarmSetting, {
      where: { userId: In(userIds) },
    });
    return new Map(settings.map((setting) => [setting.userId, setting[field]]));
  }

  // 조건에 맞는 알림이 이미 있는 사용자를 뺀다 (중복 생성 방지)
  private async excludeUsersWithAlarm(
    userIds: number[],
    where: FindOptionsWhere<UserAlarm>,
    manager: EntityManager,
  ): Promise<number[]> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return [];
    const existing = await manager.find(UserAlarm, {
      select: { userId: true },
      where: { ...where, userId: In(uniqueIds) },
    });
    const existingIds = new Set(existing.map((alarm) => alarm.userId));
    return uniqueIds.filter((id) => !existingIds.has(id));
  }

  // 새 마감 시각 기준으로 알림 시각을 다시 계산한다
  private async rescheduleAlarms(
    alarms: Pick<UserAlarm, 'id' | 'userId'>[],
    deadline: Date,
    field: 'deadlineAlarm' | 'taskAlarm',
    manager: EntityManager,
  ): Promise<void> {
    if (alarms.length === 0) return;
    const hoursMap = await this.getAlarmHours(
      alarms.map((alarm) => alarm.userId),
      field,
      manager,
    );
    const updated = alarms.map((alarm) =>
      manager.create(UserAlarm, {
        id: alarm.id,
        alarmDate: addHours(
          deadline,
          -(hoursMap.get(alarm.userId) ?? DEFAULT_ALARM_HOURS),
        ),
      }),
    );
    await manager.save(UserAlarm, updated);
    await this.clearPushed(updated.map((alarm) => alarm.id));
  }

  // 아직 보내지 않은(알림 시각 전) 과제 마감 알림 삭제 — 이미 받은 알림은 목록에 남긴다
  private async deletePendingTaskAlarms(
    taskId: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(UserAlarm, {
      taskId,
      type: AlarmType.TASK,
      alarmDate: MoreThan(new Date()),
    });
  }

  // 아직 보내지 않은(알림 시각 전) 세부 과제 알림 삭제
  private async deletePendingSubTaskAlarms(
    subTaskId: number,
    manager: EntityManager,
  ): Promise<void> {
    await manager.delete(UserAlarm, {
      subTaskId,
      alarmDate: MoreThan(new Date()),
    });
  }

  // 시각이 바뀐 알림은 새 시각에 다시 푸시되도록 발송 표시를 지운다
  private async clearPushed(alarmIds: number[]): Promise<void> {
    await Promise.all(
      alarmIds.map((id) => this.redisService.del(pushedAlarmKey(id))),
    );
  }
}
