import { Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { AlarmType, SubTaskStatus } from '../common/enums';
import { addHours } from '../common/utils/date.util';
import { UserAlarmSetting } from '../users/entities/user-alarm-setting.entity';
import { UserAlarm } from '../alarms/user-alarm.entity';

// 알림 설정이 없는 유저의 기본값 (마감 N시간 전)
const DEFAULT_ALARM_HOURS = 24;

type AlarmHours = Pick<UserAlarmSetting, 'deadlineAlarm' | 'taskAlarm'>;

// UserAlarm.title·alarm_content는 varchar(50)
const ALARM_TEXT_MAX_LENGTH = 50;

type NewAlarm = Omit<
  UserAlarm,
  'id' | 'createdAt' | 'user' | 'task' | 'subTask'
>;

export interface AlarmTask {
  id: number;
  title: string;
  deadline: Date;
}

export interface AlarmSubTask {
  id: number;
  taskId: number;
  title: string;
  status: SubTaskStatus;
  endDate: Date | null;
  isAlarm: boolean;
}

// 세부 과제와 그 담당자들(User.id). 담당자가 없으면 빈 배열
export interface AssignedSubTask {
  subTask: AlarmSubTask;
  assigneeUserIds: number[];
}

// 알림 문구가 DB 길이를 넘으면 잘라서 저장한다 (긴 세부 과제 제목 대비)
const fitAlarmText = (text: string): string =>
  text.slice(0, ALARM_TEXT_MAX_LENGTH);

const deadlineAlarmHours = (hours: Map<number, AlarmHours>, userId: number) =>
  hours.get(userId)?.deadlineAlarm ?? DEFAULT_ALARM_HOURS;

const taskAlarmHours = (hours: Map<number, AlarmHours>, userId: number) =>
  hours.get(userId)?.taskAlarm ?? DEFAULT_ALARM_HOURS;

type NotifiableSubTask = AlarmSubTask & { endDate: Date };

// 알림을 받을 수 있는 세부 과제인지 (알림 켜짐 + 마감일). 담당자 한 명마다 알림 1개
const isNotifiable = (subTask: AlarmSubTask): subTask is NotifiableSubTask =>
  subTask.isAlarm && subTask.endDate !== null;

/**
 * 과제·세부 과제 변경에 맞춰 알림(UserAlarm)을 만들고·고치고·지운다.
 * 모든 메서드는 호출한 쪽의 트랜잭션(manager) 안에서 실행된다.
 * 알림 조회·발송(cron)·알림 API는 alarms 도메인이 맡는다.
 */
@Injectable()
export class TaskAlarmService {
  /** 과제 마감 알림 (마감 deadlineAlarm시간 전) */
  async createTaskAlarms(
    manager: EntityManager,
    task: AlarmTask,
    userIds: number[],
    progressRate: number,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const hours = await this.getAlarmHours(manager, userIds);
    await manager.insert(
      UserAlarm,
      userIds.map((userId) =>
        this.buildTaskAlarm(userId, task, hours, progressRate),
      ),
    );
  }

  /** 세부 과제 마감 알림을 담당자마다 만든다 (마감 taskAlarm시간 전). 알림이 꺼졌거나 마감일이 없으면 건너뛴다 */
  async createSubTaskAlarms(
    manager: EntityManager,
    items: AssignedSubTask[],
  ): Promise<void> {
    const targets = items.flatMap(({ subTask, assigneeUserIds }) =>
      isNotifiable(subTask)
        ? assigneeUserIds.map((userId) => ({ subTask, userId }))
        : [],
    );
    if (targets.length === 0) return;
    const hours = await this.getAlarmHours(
      manager,
      targets.map((target) => target.userId),
    );
    await manager.insert(
      UserAlarm,
      targets.map(({ subTask, userId }) =>
        this.buildSubTaskAlarm(userId, subTask, hours),
      ),
    );
  }

  /** 기존 팀원들에게 "새 팀원 참여" 알림 (바로 발송) */
  async createMemberJoinAlarms(
    manager: EntityManager,
    task: Pick<AlarmTask, 'id' | 'title'>,
    userIds: number[],
    nickname: string,
  ): Promise<void> {
    if (userIds.length === 0) return;
    await manager.insert(
      UserAlarm,
      userIds.map((userId) => ({
        userId,
        taskId: task.id,
        subTaskId: null,
        type: AlarmType.MEMBER,
        title: '새로운 팀원이 참여했어요!',
        alarmContent: fitAlarmText(
          `${nickname}님이 '${task.title}'에 참여했습니다.`,
        ),
        alarmDate: new Date(),
        isRead: false,
      })),
    );
  }

  /** 과제 마감일이 바뀌면 과제 마감 알림 시각을 다시 계산한다 (팀원 참여 알림 등은 그대로) */
  async rescheduleTaskAlarms(
    manager: EntityManager,
    taskId: number,
    deadline: Date,
  ): Promise<void> {
    const alarms = await manager.find(UserAlarm, {
      where: [
        { taskId, subTaskId: IsNull(), type: AlarmType.TASK },
        // type 컬럼 추가 전에 만든 레거시 과제 알림
        { taskId, subTaskId: IsNull(), type: IsNull() },
      ],
    });
    if (alarms.length === 0) return;
    const hours = await this.getAlarmHours(
      manager,
      alarms.map((alarm) => alarm.userId),
    );
    for (const alarm of alarms) {
      alarm.alarmDate = addHours(
        deadline,
        -deadlineAlarmHours(hours, alarm.userId),
      );
    }
    await manager.save(alarms);
  }

  /**
   * 세부 과제 상태(마감일·알림 여부·담당자·제목)에 맞춰 알림을 맞춘다.
   * 담당자마다 알림 1개를 두며, 기존 알림은 고치고 없는 알림은 만든다.
   * 담당에서 빠진 사람의 알림과, 알림이 꺼졌거나 마감일이 없는 세부 과제의 알림은 지운다.
   */
  async syncSubTaskAlarms(
    manager: EntityManager,
    items: AssignedSubTask[],
  ): Promise<void> {
    if (items.length === 0) return;
    const existingAlarms = await manager.find(UserAlarm, {
      where: { subTaskId: In(items.map((item) => item.subTask.id)) },
    });
    const hours = await this.getAlarmHours(
      manager,
      items.flatMap((item) => item.assigneeUserIds),
    );

    const alarmsToSave: UserAlarm[] = [];
    const alarmsToInsert: NewAlarm[] = [];
    const alarmIdsToDelete: number[] = [];
    for (const { subTask, assigneeUserIds } of items) {
      const existing = existingAlarms.filter(
        (alarm) => alarm.subTaskId === subTask.id,
      );
      const recipients = isNotifiable(subTask)
        ? new Set(assigneeUserIds)
        : new Set<number>();
      const kept = new Set<number>();

      for (const alarm of existing) {
        // 담당자의 첫 알림만 남기고, 담당에서 빠졌거나 중복된 알림은 지운다
        if (!recipients.has(alarm.userId) || kept.has(alarm.userId)) {
          alarmIdsToDelete.push(alarm.id);
          continue;
        }
        kept.add(alarm.userId);
        const next = this.buildSubTaskAlarm(
          alarm.userId,
          subTask as NotifiableSubTask,
          hours,
        );
        alarm.title = next.title;
        alarm.alarmContent = next.alarmContent;
        alarm.alarmDate = next.alarmDate;
        alarmsToSave.push(alarm);
      }
      for (const userId of recipients) {
        if (kept.has(userId)) continue;
        alarmsToInsert.push(
          this.buildSubTaskAlarm(userId, subTask as NotifiableSubTask, hours),
        );
      }
    }

    if (alarmsToSave.length > 0) await manager.save(alarmsToSave);
    if (alarmsToInsert.length > 0) {
      await manager.insert(UserAlarm, alarmsToInsert);
    }
    if (alarmIdsToDelete.length > 0) {
      await manager.delete(UserAlarm, { id: In(alarmIdsToDelete) });
    }
  }

  /** 과제에서 나간(추방된) 참여자의 이 과제 알림을 지운다 */
  async deleteUserTaskAlarms(
    manager: EntityManager,
    userId: number,
    taskId: number,
  ): Promise<void> {
    await manager.delete(UserAlarm, { userId, taskId });
  }

  private buildTaskAlarm(
    userId: number,
    task: AlarmTask,
    hours: Map<number, AlarmHours>,
    progressRate: number,
  ): NewAlarm {
    const alarmHours = deadlineAlarmHours(hours, userId);
    return {
      userId,
      taskId: task.id,
      subTaskId: null,
      type: AlarmType.TASK,
      title: fitAlarmText(
        `'${task.title}'의 마감까지 ${alarmHours}시간 남았어요!`,
      ),
      alarmContent: fitAlarmText(
        `'현재 ${progressRate}%완성 중이에요. 빨리 끝내고 쉬어요!`,
      ),
      alarmDate: addHours(task.deadline, -alarmHours),
      isRead: false,
    };
  }

  private buildSubTaskAlarm(
    userId: number,
    subTask: NotifiableSubTask,
    hours: Map<number, AlarmHours>,
  ): NewAlarm {
    const alarmHours = taskAlarmHours(hours, userId);
    const state =
      subTask.status === SubTaskStatus.COMPLETED ? '완료' : '진행 중';
    return {
      userId,
      taskId: subTask.taskId,
      subTaskId: subTask.id,
      type: AlarmType.SUBTASK,
      title: fitAlarmText(
        `'${subTask.title}'의 마감까지 ${alarmHours}시간 남았어요!`,
      ),
      alarmContent: fitAlarmText(
        `'현재 ${state} 상태에요. 빨리 끝내고 쉬어요!`,
      ),
      alarmDate: addHours(subTask.endDate, -alarmHours),
      isRead: false,
    };
  }

  /** 유저별 알림 설정 (설정이 없는 유저는 Map에 없음 → DEFAULT_ALARM_HOURS 사용) */
  private async getAlarmHours(
    manager: EntityManager,
    userIds: number[],
  ): Promise<Map<number, AlarmHours>> {
    if (userIds.length === 0) return new Map();
    const settings = await manager.getRepository(UserAlarmSetting).find({
      where: { userId: In([...new Set(userIds)]) },
      select: { userId: true, deadlineAlarm: true, taskAlarm: true },
    });
    return new Map(settings.map((setting) => [setting.userId, setting]));
  }
}
