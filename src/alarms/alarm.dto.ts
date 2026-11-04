import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskType } from '../common/enums';
import {
  CursorMeta,
  CursorPaginationQueryDto,
} from '../common/pagination/pagination.dto';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { AlarmType } from './alarm-type.enum';
import { UserAlarm } from './alarm.entity';

// ===== 요청 =====

// 목록 정렬 기준으로 허용하는 컬럼 (레거시는 아무 문자열이나 받았음)
export const ALARM_ORDER_BY = ['alarmDate', 'createdAt'] as const;
export type AlarmOrderBy = (typeof ALARM_ORDER_BY)[number];

export const SORT_ORDER = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDER)[number];

export class GetAlarmsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({
    enum: ALARM_ORDER_BY,
    default: 'alarmDate',
    description: '정렬 기준',
  })
  @IsOptional()
  @IsIn(ALARM_ORDER_BY)
  orderBy: AlarmOrderBy = 'alarmDate';

  @ApiPropertyOptional({
    enum: SORT_ORDER,
    default: 'desc',
    description: '정렬 순서',
  })
  @IsOptional()
  @IsIn(SORT_ORDER)
  order: SortOrder = 'desc';

  @ApiPropertyOptional({
    enum: AlarmType,
    description: '알림 타입 필터 (미전달 시 전체)',
  })
  @IsOptional()
  @IsEnum(AlarmType)
  type?: AlarmType;
}

export class UpdateAlarmReadStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isRead: boolean;
}

export class UpdateDeadlineAlarmDto {
  @ApiProperty({ example: 24, description: '알림 전송 시간 (시간 단위)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deadlineAlarm: number;
}

export class UpdateTaskAlarmDto {
  @ApiProperty({ example: 24, description: '알림 전송 시간 (시간 단위)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taskAlarm: number;
}

export class UpdateAlarmStatusDto {
  @ApiProperty({ example: true, description: '알림 여부' })
  @IsBoolean()
  isAlarm: boolean;
}

export class RegisterDeviceDto {
  @ApiProperty({
    description: '파이어베이스(FCM)에서 발급받은 모바일 기기 고유 토큰 값',
    example: 'bk3RNwAz3Y0:CI2g_XL5QQC6FJ3gg...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fcmToken: string;
}

export class SendTestPushDto {
  @ApiProperty({
    description: '알림 제목',
    example: '📢 체크태스크 알림 테스트',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: '알림 내용',
    example: '문서와 로직이 완벽하게 분리되었습니다! ✊',
  })
  @IsString()
  @IsNotEmpty()
  body: string;
}

// ===== 응답 =====

export class AlarmResponseDto {
  @ApiProperty({ example: 120 }) alarmId: number;
  @ApiProperty({ enum: AlarmType, nullable: true }) alarmType: AlarmType | null;
  @ApiProperty({ example: "'중간 발표'의 마감까지 24시간 남았어요!" })
  title: string;
  @ApiProperty() alarmContent: string;
  @ApiProperty() isRead: boolean;
  @ApiProperty({ example: '2026-10-20T23:59:00.000+09:00' }) alarmDate: Date;
  @ApiProperty({ enum: TaskType, nullable: true }) taskType: TaskType | null;
  @ApiProperty({ type: Number, nullable: true }) taskId: number | null;
  @ApiProperty({ type: Number, nullable: true }) subTaskId: number | null;

  /**
   * @param alarmContent 응답할 내용 (과제 알림은 현재 진척도로 바꿔서 넘긴다)
   */
  static from(alarm: UserAlarm, alarmContent: string): AlarmResponseDto {
    const dto = new AlarmResponseDto();
    dto.alarmId = alarm.id;
    dto.alarmType = alarm.type;
    dto.title = alarm.title;
    dto.alarmContent = alarmContent;
    dto.isRead = alarm.isRead;
    dto.alarmDate = alarm.alarmDate;
    dto.taskType = alarm.task?.type ?? null;
    dto.taskId = alarm.taskId;
    dto.subTaskId = alarm.subTaskId;
    return dto;
  }
}

export class CursorMetaDto implements CursorMeta {
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty({ type: Number, nullable: true, example: 120 })
  cursor: number | null;
}

// Swagger 문서용 (실제 응답은 toCursorPage가 만든다)
export class AlarmListResponseDto {
  @ApiProperty({ type: [AlarmResponseDto] }) alarmList: AlarmResponseDto[];
  @ApiProperty({ type: CursorMetaDto }) meta: CursorMetaDto;
}

export class UnreadAlarmCountResponseDto {
  @ApiProperty({ example: 3 }) count: number;
  @ApiProperty({ example: true }) hasUnread: boolean;

  static from(count: number): UnreadAlarmCountResponseDto {
    const dto = new UnreadAlarmCountResponseDto();
    dto.count = count;
    dto.hasUnread = count > 0;
    return dto;
  }
}

export class AlarmReadStatusDto {
  @ApiProperty() alarmId: number;
  @ApiProperty() userId: number;
  @ApiProperty({ type: Number, nullable: true }) taskId: number | null;
  @ApiProperty({ type: Number, nullable: true }) subTaskId: number | null;
  @ApiProperty() title: string;
  @ApiProperty() alarmContent: string;
  @ApiProperty() isRead: boolean;
}

export class AlarmReadStatusResponseDto {
  @ApiProperty({ type: AlarmReadStatusDto }) alarm: AlarmReadStatusDto;

  static from(alarm: UserAlarm): AlarmReadStatusResponseDto {
    const dto = new AlarmReadStatusResponseDto();
    dto.alarm = {
      alarmId: alarm.id,
      userId: alarm.userId,
      taskId: alarm.taskId,
      subTaskId: alarm.subTaskId,
      title: alarm.title,
      alarmContent: alarm.alarmContent,
      isRead: alarm.isRead,
    };
    return dto;
  }
}

export class DeadlineAlarmSettingDto {
  @ApiProperty() userId: number;
  @ApiProperty() nickname: string;
  @ApiProperty({ example: 24 }) deadlineAlarm: number;
}

export class DeadlineAlarmSettingResponseDto {
  @ApiProperty({ type: DeadlineAlarmSettingDto }) user: DeadlineAlarmSettingDto;

  static from(
    user: User,
    deadlineAlarm: number,
  ): DeadlineAlarmSettingResponseDto {
    const dto = new DeadlineAlarmSettingResponseDto();
    dto.user = { userId: user.id, nickname: user.nickname, deadlineAlarm };
    return dto;
  }
}

export class TaskAlarmSettingDto {
  @ApiProperty() userId: number;
  @ApiProperty() nickname: string;
  @ApiProperty({ example: 24 }) taskAlarm: number;
}

export class TaskAlarmSettingResponseDto {
  @ApiProperty({ type: TaskAlarmSettingDto }) user: TaskAlarmSettingDto;

  static from(user: User, taskAlarm: number): TaskAlarmSettingResponseDto {
    const dto = new TaskAlarmSettingResponseDto();
    dto.user = { userId: user.id, nickname: user.nickname, taskAlarm };
    return dto;
  }
}

export class TaskAlarmStatusDto {
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ example: '2026-10-20T23:59:00.000+09:00' }) deadline: Date;
  @ApiProperty() isAlarm: boolean;
  @ApiProperty({ type: Date, nullable: true }) updatedAt: Date | null;
}

export class TaskAlarmStatusResponseDto {
  @ApiProperty({ type: TaskAlarmStatusDto }) task: TaskAlarmStatusDto;

  static from(task: Task): TaskAlarmStatusResponseDto {
    const dto = new TaskAlarmStatusResponseDto();
    dto.task = {
      taskId: task.id,
      title: task.title,
      deadline: task.deadline,
      isAlarm: task.isAlarm,
      updatedAt: task.updatedAt,
    };
    return dto;
  }
}

export class SubTaskAlarmStatusDto {
  @ApiProperty() subTaskId: number;
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ type: Date, nullable: true }) endDate: Date | null;
  @ApiProperty() isAlarm: boolean;
  @ApiProperty({ type: Date, nullable: true }) updatedAt: Date | null;
}

export class SubTaskAlarmStatusResponseDto {
  // 레거시 응답 키(소문자 subtask)를 그대로 쓴다
  @ApiProperty({ type: SubTaskAlarmStatusDto }) subtask: SubTaskAlarmStatusDto;

  static from(subTask: SubTask): SubTaskAlarmStatusResponseDto {
    const dto = new SubTaskAlarmStatusResponseDto();
    dto.subtask = {
      subTaskId: subTask.id,
      taskId: subTask.taskId,
      title: subTask.title,
      endDate: subTask.endDate,
      isAlarm: subTask.isAlarm,
      updatedAt: subTask.updatedAt,
    };
    return dto;
  }
}
