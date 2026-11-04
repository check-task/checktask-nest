import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsOffsetDateTime } from '../common/decorators/is-offset-date-time.decorator';
import { SubTaskStatus, TaskStatus, TaskType } from '../common/enums';
import {
  OffsetMeta,
  OffsetPaginationQueryDto,
  toOffsetPage,
} from '../common/pagination/pagination.dto';
import { diffKstDays } from '../common/utils/date.util';
import { Comment } from '../comments/comment.entity';
import { Folder } from '../folders/folder.entity';
import { Communication } from '../references/entities/communication.entity';
import { Log } from '../references/entities/log.entity';
import { Reference } from '../references/entities/reference.entity';
import { User } from '../users/entities/user.entity';
import { MEMBER_ROLE, Member } from './entities/member.entity';
import { SUB_TASK_TITLE_MAX_LENGTH, SubTask } from './entities/sub-task.entity';
import { TASK_TITLE_MAX_LENGTH, Task } from './entities/task.entity';

// 폴더가 없을 때 응답 기본값 (레거시와 동일)
const DEFAULT_FOLDER_COLOR = '#818892';
const DEFAULT_FOLDER_TITLE_LABEL = '지정안함';

// 과제 목록 정렬 기준
export const TASK_SORT = {
  PRIORITY: 'PRIORITY',
  DEADLINE: 'DEADLINE',
  PROGRESSRATE: 'PROGRESSRATE',
} as const;

// 과제 목록 필터: 마감 전 과제만
export const TASK_LIST_STATUS_IN_PROGRESS = 'PROGRESS';

const DATE_EXAMPLE = '2026-10-20T23:59:00+09:00';
const DATE_RESPONSE_EXAMPLE = '2026-10-20T23:59:00.000+09:00';

// ===== 변환 헬퍼 =====

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// 빈 문자열은 null로 본다 (레거시 프론트가 "값 지우기"를 ''로 보냄)
const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) => (value === '' ? null : value));

// 숫자 문자열('12')도 받는다 (레거시 z.coerce와 동일). '' → null
const ToNullableNumber = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === '') return null;
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
    return value;
  });

// 담당자 한 명 (User.id). 숫자 문자열도 받는다
const AssigneeIdField = () =>
  applyDecorators(
    ApiPropertyOptional({
      description:
        '담당자 User.id (과제 참여자만 가능). assigneeIds와 함께 오면 합친다',
    }),
    IsOptional(),
    ToNullableNumber(),
    IsInt(),
    Min(1, {
      message: '담당자는 해당 과제 멤버의 User.id(양의 정수)여야 합니다.',
    }),
  );

// 담당자 여러 명 (User.id 배열)
const AssigneeIdsField = () =>
  applyDecorators(
    ApiPropertyOptional({
      type: [Number],
      example: [1, 2],
      description: '담당자 User.id 목록 (과제 참여자만 가능)',
    }),
    IsOptional(),
    IsArray(),
    Transform(({ value }: { value: unknown }) =>
      Array.isArray(value)
        ? value.map((id: unknown) =>
            typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id,
          )
        : value,
    ),
    IsInt({ each: true }),
    Min(1, { each: true }),
  );

// ===== 요청 =====

// ?type=personal|team (대소문자 무관)
const TaskTypeQuery = () =>
  applyDecorators(
    ApiPropertyOptional({ enum: TaskType }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.toUpperCase() : value,
    ),
    IsEnum(TaskType),
  );

/** 개인/팀 과제 화면에서 보내는 ?type= (주소와 실제 과제 종류가 다르면 403) */
export class CheckTaskTypeQueryDto {
  @TaskTypeQuery()
  type?: TaskType;
}

export class GetCompletedTasksQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: '폴더 ID 목록 (쉼표 구분)',
    example: '1,2',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      : value,
  )
  @IsInt({ each: true })
  folderId?: number[];
}

export class GetTasksQueryDto extends OffsetPaginationQueryDto {
  @TaskTypeQuery()
  type?: TaskType;

  @ApiPropertyOptional({
    enum: Object.values(TASK_SORT),
    description: '기본값 PRIORITY',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  folderId?: number;

  @ApiPropertyOptional({
    example: TASK_LIST_STATUS_IN_PROGRESS,
    description: 'PROGRESS면 마감 전 과제만',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTaskSubTaskDto {
  @ApiProperty({ example: '자료 조사' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '세부 과제 제목은 필수입니다.' })
  @MaxLength(SUB_TASK_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: DATE_EXAMPLE,
    description: '생략하거나 null이면 마감일 미지정',
  })
  @IsOptional()
  @IsOffsetDateTime()
  @EmptyToNull()
  endDate?: Date | null;

  @AssigneeIdField()
  assigneeId?: number;

  @AssigneeIdsField()
  assigneeIds?: number[];
}

export class CreateTaskReferenceDto {
  @ApiProperty({ example: '발표 자료' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(255)
  url?: string;
}

export class CreateTaskCommunicationDto {
  @ApiProperty({ example: '카카오톡 오픈채팅' })
  @IsString()
  @IsNotEmpty({ message: '링크 이름은 필수입니다.' })
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'https://open.kakao.com/o/abc' })
  @IsUrl(
    { require_protocol: true },
    { message: '올바른 URL 형식이어야 합니다.' },
  )
  @MaxLength(255)
  url: string;
}

export class CreateTaskDto {
  @ApiProperty({ example: '중간 발표', maxLength: TASK_TITLE_MAX_LENGTH })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다.' })
  @MaxLength(TASK_TITLE_MAX_LENGTH, {
    message: `과제명은 ${TASK_TITLE_MAX_LENGTH}자 이하여야 합니다.`,
  })
  title: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 1,
    description: '생략하거나 null이면 "지정안함" 폴더',
  })
  @IsOptional()
  @ToNullableNumber()
  @IsInt({ message: '폴더 ID는 정수여야 합니다.' })
  @Min(1, { message: '유효하지 않은 폴더 ID입니다.' })
  folderId?: number | null;

  @ApiProperty({ type: String, format: 'date-time', example: DATE_EXAMPLE })
  @IsOffsetDateTime()
  deadline: Date;

  @ApiPropertyOptional({ enum: TaskType, default: TaskType.PERSONAL })
  @IsOptional()
  @IsEnum(TaskType)
  type: TaskType = TaskType.PERSONAL;

  @ApiPropertyOptional({ type: [CreateTaskSubTaskDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskSubTaskDto)
  subTasks: CreateTaskSubTaskDto[] = [];

  @ApiPropertyOptional({ type: [CreateTaskReferenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskReferenceDto)
  references: CreateTaskReferenceDto[] = [];

  @ApiPropertyOptional({ type: [CreateTaskCommunicationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskCommunicationDto)
  communications: CreateTaskCommunicationDto[] = [];
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ maxLength: TASK_TITLE_MAX_LENGTH })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다.' })
  @MaxLength(TASK_TITLE_MAX_LENGTH, {
    message: `과제명은 ${TASK_TITLE_MAX_LENGTH}자 이하여야 합니다.`,
  })
  title?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null이면 "지정안함" 폴더로 이동',
  })
  @IsOptional()
  @ToNullableNumber()
  @IsInt()
  @Min(1)
  folderId?: number | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: DATE_EXAMPLE,
  })
  @IsOptional()
  @IsOffsetDateTime()
  deadline?: Date;
}

export class UpdateTaskDeadlineDto {
  @ApiProperty({ type: String, format: 'date-time', example: DATE_EXAMPLE })
  @IsOffsetDateTime({ message: '마감일은 필수입니다.' })
  deadline: Date;
}

export class TaskPriorityItemDto {
  @ApiProperty({ example: 1 })
  @ToNullableNumber()
  @IsInt()
  @Min(1)
  taskId: number;

  @ApiProperty({ example: 1, description: '작을수록 위' })
  @IsInt()
  @Min(1)
  rank: number;
}

export class UpdateTaskPrioritiesDto {
  @ApiProperty({ type: [TaskPriorityItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'orderedTasks는 최소 1개 이상이어야 합니다.' })
  @ValidateNested({ each: true })
  @Type(() => TaskPriorityItemDto)
  orderedTasks: TaskPriorityItemDto[];
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: [0, 1], description: '0: 소유자(Owner), 1: 팀원' })
  @IsIn([0, 1], { message: 'role은 0(Owner) 또는 1(Member)이어야 합니다.' })
  role: 0 | 1;
}

export class CreateSubTaskDto {
  @ApiProperty({ example: '자료 조사' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '세부 과제 제목은 필수입니다.' })
  @MaxLength(SUB_TASK_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: DATE_EXAMPLE,
    description: '생략하거나 null이면 마감일 미지정',
  })
  @IsOptional()
  @IsOffsetDateTime()
  @EmptyToNull()
  deadline?: Date | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAlarm?: boolean;

  @AssigneeIdField()
  assigneeId?: number;

  @AssigneeIdsField()
  assigneeIds?: number[];
}

export class UpdateSubTaskStatusDto {
  @ApiProperty({ enum: [SubTaskStatus.PENDING, SubTaskStatus.COMPLETED] })
  @IsIn([SubTaskStatus.PENDING, SubTaskStatus.COMPLETED], {
    message: 'status는 PENDING 또는 COMPLETED여야 합니다.',
  })
  status: SubTaskStatus.PENDING | SubTaskStatus.COMPLETED;
}

export class UpdateSubTaskDeadlineDto {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: DATE_EXAMPLE,
    description: 'null이면 마감일 미지정으로 되돌림',
  })
  @ValidateIf((dto: UpdateSubTaskDeadlineDto) => dto.endDate !== null)
  @IsOffsetDateTime()
  @EmptyToNull()
  endDate: Date | null;
}

/** assigneeId·assigneeIds를 합친 목록으로 담당자를 통째로 바꾼다. 둘 다 없거나 비면 담당자 해제 */
export class SetSubTaskAssigneeDto {
  @AssigneeIdField()
  assigneeId?: number | null;

  @AssigneeIdsField()
  assigneeIds?: number[];
}

export class JoinTaskDto {
  @ApiProperty({ example: 'A1B2C3D4' })
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '초대 코드는 필수입니다.' })
  inviteCode: string;

  @ApiPropertyOptional({
    nullable: true,
    description: '생략하거나 null이면 "지정안함" 폴더',
  })
  @IsOptional()
  @ToNullableNumber()
  @IsInt({ message: '폴더 ID는 정수여야 합니다.' })
  @Min(1, { message: '유효하지 않은 폴더 ID입니다.' })
  folderId?: number | null;
}

export class UpdateSubTaskItemDto {
  @ApiProperty({ example: 1 })
  @ToNullableNumber()
  @IsInt()
  @Min(1)
  subTaskId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty({ message: '세부 과제 제목은 필수입니다.' })
  @MaxLength(SUB_TASK_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'endDate와 같은 값 (레거시 호환). 둘 다 오면 endDate 우선',
  })
  @IsOptional()
  @IsOffsetDateTime()
  @EmptyToNull()
  deadline?: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'null이면 마감일 미지정으로 되돌림',
  })
  @IsOptional()
  @IsOffsetDateTime()
  @EmptyToNull()
  endDate?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAlarm?: boolean;

  // 둘 중 하나라도 오면 담당자를 통째로 바꾼다 (빈 배열이면 해제)
  @AssigneeIdField()
  assigneeId?: number;

  @AssigneeIdsField()
  assigneeIds?: number[];
}

export class UpdateSubTasksDto {
  @ApiProperty({ type: [UpdateSubTaskItemDto] })
  @IsArray()
  @ArrayMinSize(1, {
    message: '수정할 세부 과제를 최소 1개 이상 선택해야 합니다.',
  })
  @ValidateNested({ each: true })
  @Type(() => UpdateSubTaskItemDto)
  subTasks: UpdateSubTaskItemDto[];
}

export class DeleteSubTasksDto {
  @ApiProperty({ type: [Number], example: [1, 2] })
  @IsArray()
  @ArrayMinSize(1, {
    message: '삭제할 세부 과제를 최소 1개 이상 선택해야 합니다.',
  })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id,
        )
      : value,
  )
  @IsInt({ each: true })
  @Min(1, { each: true })
  subTaskIds: number[];
}

// ===== 응답 =====

/**
 * KST 날짜 기준 D-Day 문자열
 * @example 마감 3일 전 → 'D-3', 당일 → 'D-Day', 2일 지남 → 'D+2'
 */
export const toDDay = (deadline: Date, now: Date = new Date()): string => {
  const diff = diffKstDays(now, deadline);
  if (diff === 0) return 'D-Day';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
};

export class TaskIdResponseDto {
  @ApiProperty() taskId: number;
}

export class ConvertTaskResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty({ enum: TaskType }) type: TaskType;
}

export class TaskDeadlineResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) deadline: Date;
}

export class CompletedTaskResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) deadline: Date;
  @ApiProperty({ enum: ['개인', '팀'] }) type: string;
  @ApiProperty({ enum: ['완료', '미완료'] }) status: string;
  @ApiProperty({ nullable: true }) folderId: number | null;
  @ApiProperty({ nullable: true }) folderTitle: string | null;
  @ApiProperty() color: string;

  static from(task: Task, folder: Folder | null): CompletedTaskResponseDto {
    const dto = new CompletedTaskResponseDto();
    dto.taskId = task.id;
    dto.title = task.title;
    dto.deadline = task.deadline;
    dto.type = task.type === TaskType.PERSONAL ? '개인' : '팀';
    dto.status = task.status === TaskStatus.COMPLETED ? '완료' : '미완료';
    dto.folderId = folder?.id ?? null;
    dto.folderTitle = folder?.folderTitle ?? null;
    dto.color = folder?.color ?? '#000000';
    return dto;
  }
}

// 오프셋 페이지네이션 meta (Swagger 문서용)
export class OffsetMetaResponseDto implements OffsetMeta {
  @ApiProperty() hasNextPage: boolean;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 10 }) size: number;
  @ApiProperty() totalCount: number;
}

// Service는 toOffsetPage(items, totalCount, query, 'tasks')로 만든다 (Swagger 문서용)
export class CompletedTasksResponseDto {
  @ApiProperty({ type: [CompletedTaskResponseDto] })
  tasks: CompletedTaskResponseDto[];

  @ApiProperty() meta: OffsetMetaResponseDto;
}

// 목록 조회 시 Service가 계산해서 넘기는 값
export interface TaskListRow {
  task: Task;
  folder: Folder | null;
  priority: number | null;
  progressRate: number;
}

export class TaskListItemResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty({ nullable: true }) folderId: number | null;
  @ApiProperty() foldercolor: string;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ nullable: true }) folderRank: number | null;
  @ApiProperty({ nullable: true }) priority: number | null;
  @ApiProperty({ enum: TaskStatus }) status: TaskStatus;
  @ApiProperty() title: string;
  @ApiProperty({ enum: TaskType }) type: TaskType;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) deadline: Date;
  @ApiProperty({ example: 'D-3' }) dDay: string;
  @ApiProperty({ example: 50 }) progressRate: number;

  static from(row: TaskListRow): TaskListItemResponseDto {
    const dto = new TaskListItemResponseDto();
    dto.taskId = row.task.id;
    dto.folderId = row.folder?.id ?? null;
    dto.foldercolor = row.folder?.color ?? DEFAULT_FOLDER_COLOR;
    dto.folderTitle = row.folder?.folderTitle ?? DEFAULT_FOLDER_TITLE_LABEL;
    dto.folderRank = row.folder?.rank ?? null;
    dto.priority = row.priority;
    dto.status = row.task.status;
    dto.title = row.task.title;
    dto.type = row.task.type;
    dto.deadline = row.task.deadline;
    dto.dDay = toDDay(row.task.deadline);
    dto.progressRate = row.progressRate;
    return dto;
  }
}

export class SubTaskListItemResponseDto {
  @ApiProperty() subTaskId: number;
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SubTaskStatus }) status: SubTaskStatus;
  @ApiProperty({ nullable: true, example: DATE_RESPONSE_EXAMPLE })
  deadline: Date | null;

  static from(subTask: SubTask): SubTaskListItemResponseDto {
    const dto = new SubTaskListItemResponseDto();
    dto.subTaskId = subTask.id;
    dto.taskId = subTask.taskId;
    dto.title = subTask.title;
    dto.status = subTask.status;
    dto.deadline = subTask.endDate;
    return dto;
  }
}

export class TaskListResponseDto {
  @ApiProperty({ type: [TaskListItemResponseDto] })
  task: TaskListItemResponseDto[];

  @ApiProperty({
    type: [SubTaskListItemResponseDto],
    description: '완료되지 않은 세부 과제',
  })
  subTask: SubTaskListItemResponseDto[];

  @ApiProperty() meta: OffsetMetaResponseDto;

  /**
   * @param rows 이번 페이지의 과제 (정렬 완료)
   * @param totalCount 필터에 맞는 전체 과제 수
   */
  static from(
    rows: TaskListRow[],
    totalCount: number,
    query: Pick<OffsetPaginationQueryDto, 'page' | 'size'>,
  ): TaskListResponseDto {
    const page = toOffsetPage(
      rows.map((row) => TaskListItemResponseDto.from(row)),
      totalCount,
      query,
      'task',
    );
    const dto = new TaskListResponseDto();
    dto.task = page.task;
    dto.meta = page.meta;
    // 이번 페이지 과제들의 미완료 세부 과제
    dto.subTask = rows.flatMap(({ task }) =>
      task.subTasks
        .filter((subTask) => subTask.status !== SubTaskStatus.COMPLETED)
        .map((subTask) => SubTaskListItemResponseDto.from(subTask)),
    );
    return dto;
  }
}

export class SubTaskCommentResponseDto {
  @ApiProperty() commentId: number;
  @ApiProperty() content: string;
  @ApiProperty() writer: string;
  @ApiProperty({ nullable: true }) profileImage: string | null;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) createdAt: Date;

  static from(comment: Comment): SubTaskCommentResponseDto {
    const dto = new SubTaskCommentResponseDto();
    dto.commentId = comment.id;
    dto.content = comment.content;
    dto.writer = comment.user?.nickname ?? '미지정';
    dto.profileImage = comment.user?.profileImage ?? null;
    dto.createdAt = comment.createdAt;
    return dto;
  }
}

export class AssigneeResponseDto {
  @ApiProperty() memberId: number;
  @ApiProperty() userId: number;
  @ApiProperty() nickname: string;
  @ApiProperty({ nullable: true }) profileImage: string | null;

  static from(member: Member): AssigneeResponseDto {
    const dto = new AssigneeResponseDto();
    dto.memberId = member.id;
    dto.userId = member.user.id;
    dto.nickname = member.user.nickname;
    dto.profileImage = member.user.profileImage;
    return dto;
  }
}

export class SubTaskDetailResponseDto {
  @ApiProperty() subTaskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true, example: DATE_RESPONSE_EXAMPLE })
  deadline: Date | null;
  @ApiProperty({ enum: [SubTaskStatus.PENDING, SubTaskStatus.COMPLETED] })
  status: SubTaskStatus;
  @ApiProperty() isAlarm: boolean;
  @ApiProperty() commentCount: number;
  @ApiProperty({ type: [SubTaskCommentResponseDto] })
  comments: SubTaskCommentResponseDto[];
  @ApiProperty({
    type: [AssigneeResponseDto],
    description: '담당자 (없으면 빈 배열)',
  })
  assignees: AssigneeResponseDto[];

  static from(subTask: SubTask): SubTaskDetailResponseDto {
    const dto = new SubTaskDetailResponseDto();
    dto.subTaskId = subTask.id;
    dto.title = subTask.title;
    dto.deadline = subTask.endDate;
    dto.status =
      subTask.status === SubTaskStatus.COMPLETED
        ? SubTaskStatus.COMPLETED
        : SubTaskStatus.PENDING;
    dto.isAlarm = subTask.isAlarm;
    dto.commentCount = subTask.comments.length;
    dto.comments = subTask.comments.map((comment) =>
      SubTaskCommentResponseDto.from(comment),
    );
    dto.assignees = subTask.assignees.map((assignee) =>
      AssigneeResponseDto.from(assignee.member),
    );
    return dto;
  }
}

export class TaskReferenceResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() taskId: number;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) fileName: string | null;
  @ApiProperty({ nullable: true }) url: string | null;
  @ApiProperty({ nullable: true }) fileUrl: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) updatedAt: Date | null;

  static from(reference: Reference): TaskReferenceResponseDto {
    const dto = new TaskReferenceResponseDto();
    dto.id = reference.id;
    dto.taskId = reference.taskId;
    dto.name = reference.name;
    dto.fileName = reference.fileName;
    dto.url = reference.url;
    dto.fileUrl = reference.fileUrl;
    dto.createdAt = reference.createdAt;
    dto.updatedAt = reference.updatedAt;
    return dto;
  }
}

export class TaskLogResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() taskId: number;
  @ApiProperty({ example: '2026-10-20' }) date: string;
  @ApiProperty({ nullable: true }) agenda: string | null;
  @ApiProperty({ nullable: true }) conclusion: string | null;
  @ApiProperty({ nullable: true }) discussion: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) updatedAt: Date | null;

  static from(log: Log): TaskLogResponseDto {
    const dto = new TaskLogResponseDto();
    dto.id = log.id;
    dto.taskId = log.taskId;
    dto.date = log.date;
    dto.agenda = log.agenda;
    dto.conclusion = log.conclusion;
    dto.discussion = log.discussion;
    dto.createdAt = log.createdAt;
    dto.updatedAt = log.updatedAt;
    return dto;
  }
}

export class TaskCommunicationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() taskId: number;
  @ApiProperty() name: string;
  @ApiProperty() url: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) updatedAt: Date | null;

  static from(communication: Communication): TaskCommunicationResponseDto {
    const dto = new TaskCommunicationResponseDto();
    dto.id = communication.id;
    dto.taskId = communication.taskId;
    dto.name = communication.name;
    dto.url = communication.url;
    dto.createdAt = communication.createdAt;
    dto.updatedAt = communication.updatedAt;
    return dto;
  }
}

// 상세 조회 시 Service가 모아서 넘기는 값
export interface TaskDetailSource {
  task: Task;
  folder: Folder | null;
  subTasks: SubTask[];
  progressRate: number;
  references: Reference[];
  logs: Log[];
  communications: Communication[];
}

export class TaskDetailResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) folderId: number | null;
  @ApiProperty() foldercolor: string;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ enum: TaskStatus }) status: TaskStatus;
  @ApiProperty({ enum: TaskType }) type: TaskType;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) deadline: Date;
  @ApiProperty({ example: 'D-3' }) dDay: string;
  @ApiProperty({ example: 50 }) progressRate: number;
  @ApiProperty({
    type: [SubTaskDetailResponseDto],
    description: '마감일 순, 완료된 세부 과제는 뒤로',
  })
  subTasks: SubTaskDetailResponseDto[];
  @ApiProperty({ type: [TaskCommunicationResponseDto] })
  communications: TaskCommunicationResponseDto[];
  @ApiProperty({ type: [TaskLogResponseDto] })
  meetingLogs: TaskLogResponseDto[];
  @ApiProperty({ type: [TaskReferenceResponseDto] })
  references: TaskReferenceResponseDto[];

  static from(source: TaskDetailSource): TaskDetailResponseDto {
    const { task, folder } = source;
    const dto = new TaskDetailResponseDto();
    dto.taskId = task.id;
    dto.title = task.title;
    dto.folderId = folder?.id ?? null;
    dto.foldercolor = folder?.color ?? DEFAULT_FOLDER_COLOR;
    dto.folderTitle = folder?.folderTitle ?? DEFAULT_FOLDER_TITLE_LABEL;
    dto.status = task.status;
    dto.type = task.type;
    dto.deadline = task.deadline;
    dto.dDay = toDDay(task.deadline);
    dto.progressRate = source.progressRate;
    dto.subTasks = source.subTasks.map((subTask) =>
      SubTaskDetailResponseDto.from(subTask),
    );
    dto.communications = source.communications.map((communication) =>
      TaskCommunicationResponseDto.from(communication),
    );
    dto.meetingLogs = source.logs.map((log) => TaskLogResponseDto.from(log));
    dto.references = source.references.map((reference) =>
      TaskReferenceResponseDto.from(reference),
    );
    return dto;
  }
}

export class MemberRoleResponseDto {
  @ApiProperty({ description: '요청한 사용자의 User.id' }) memberId: number;
  @ApiProperty() targetUserId: number;
  @ApiProperty() taskId: number;
  @ApiProperty({ description: 'false: 소유자, true: 팀원' }) role: boolean;
}

export class RemovedMemberResponseDto {
  @ApiProperty({ description: 'Member.id' }) id: number;
  @ApiProperty() userId: number;
  @ApiProperty() taskId: number;
}

export class SubTaskStatusResponseDto {
  @ApiProperty() sub_task_id: number;
  @ApiProperty({ enum: ['완료', '미완료'] }) status: string;
}

export class SubTaskDeadlineResponseDto {
  @ApiProperty() sub_task_id: number;
  @ApiProperty({ nullable: true, example: DATE_RESPONSE_EXAMPLE })
  end_date: Date | null;
}

export class SubTaskAssigneesResponseDto {
  @ApiProperty() sub_task_id: number;
  @ApiProperty({ type: [AssigneeResponseDto] })
  assignees: AssigneeResponseDto[];
}

export class InviteCodeResponseDto {
  @ApiProperty({ example: 'A1B2C3D4' }) invite_code: string;
  @ApiProperty({ example: DATE_RESPONSE_EXAMPLE }) invite_expired: Date;
}

export class JoinTaskResponseDto {
  @ApiProperty() task_id: number;
  @ApiProperty() task_title: string;
  @ApiProperty({ description: 'Member.id' }) member_id: number;
  @ApiProperty() folderId: number;
}

export class CreatedSubTaskResponseDto {
  @ApiProperty() subTaskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true, example: DATE_RESPONSE_EXAMPLE })
  deadline: Date | null;
}

export class UpdatedSubTaskResponseDto {
  @ApiProperty() subTaskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true, example: DATE_RESPONSE_EXAMPLE })
  deadline: Date | null;
  @ApiProperty() isAlarm: boolean;

  static from(subTask: SubTask): UpdatedSubTaskResponseDto {
    const dto = new UpdatedSubTaskResponseDto();
    dto.subTaskId = subTask.id;
    dto.title = subTask.title;
    dto.deadline = subTask.endDate;
    dto.isAlarm = subTask.isAlarm;
    return dto;
  }
}

export class DeletedSubTasksResponseDto {
  @ApiProperty() deletedCount: number;
}

export class DeletedAllSubTasksResponseDto {
  @ApiProperty({ type: [Number], description: '삭제된 세부 과제 ID' })
  deleted: number[];
}

export class LeaveTaskResponseDto {
  @ApiProperty({
    enum: ['task', 'member'],
    description: '소유자면 과제 삭제, 팀원이면 본인만 나감',
  })
  deleted: 'task' | 'member';
  @ApiProperty() taskId: number;
  @ApiPropertyOptional({ description: '팀원이 나갔을 때 Member.id' })
  memberId?: number;
  @ApiPropertyOptional({ description: '팀원이 나갔을 때 User.id' })
  userId?: number;
}

export class TaskMemberResponseDto {
  @ApiProperty({ description: 'User.id' }) id: number;
  @ApiProperty({ nullable: true }) profileImage: string | null;
  @ApiProperty() nickname: string;
  @ApiProperty({ enum: ['owner', 'member'] }) role: 'owner' | 'member';

  static from(member: Member): TaskMemberResponseDto {
    const dto = new TaskMemberResponseDto();
    dto.id = member.user.id;
    dto.profileImage = member.user.profileImage;
    dto.nickname = member.user.nickname;
    dto.role = member.role === MEMBER_ROLE.OWNER ? 'owner' : 'member';
    return dto;
  }
}

export class TaskMembersResponseDto {
  @ApiProperty({ type: [TaskMemberResponseDto] })
  members: TaskMemberResponseDto[];
  @ApiProperty() count: number;
}

export class MemberProfileResponseDto {
  @ApiProperty() nickname: string;
  @ApiProperty() phoneNum: string;
  @ApiProperty() email: string;
  @ApiProperty({ nullable: true }) profileImage: string | null;

  static from(user: User): MemberProfileResponseDto {
    const dto = new MemberProfileResponseDto();
    dto.nickname = user.nickname;
    dto.phoneNum = user.phoneNum;
    dto.email = user.email;
    dto.profileImage = user.profileImage;
    return dto;
  }
}
