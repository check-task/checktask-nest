import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SubTaskStatus, TaskStatus, TaskType } from '../common/enums';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { toDDay } from '../tasks/task.dto';
import { Folder } from './folder.entity';

// 사용자가 고를 수 있는 폴더 색상
export const ALLOWED_COLORS = [
  '#818892',
  '#F55757',
  '#FFC93F',
  '#6EC77B',
  '#A177E2',
  '#081221',
  '#B5BAC4',
];

// 앞뒤 공백 제거 (문자열이 아니면 그대로 두고 검증에서 걸러낸다)
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// 색상은 대문자 HEX로 저장한다
const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ===== 요청 =====

export class CreateFolderDto {
  @ApiProperty({ example: '전공', maxLength: 10 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '폴더 이름은 필수입니다.' })
  @MaxLength(10, { message: '폴더 이름은 최대 10자까지만 가능합니다.' })
  folderTitle: string;

  @ApiProperty({ enum: ALLOWED_COLORS, example: '#F55757' })
  @Transform(trimUpper)
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/, {
    message: '색상은 #을 포함한 7자리 Hex 코드여야 합니다.',
  })
  @IsIn(ALLOWED_COLORS, { message: '허용되지 않는 색상입니다.' })
  color: string;
}

/**
 * 폴더 수정
 * folderTitle·color 중 보낸 값만 수정한다. (둘 다 없으면 400)
 */
export class UpdateFolderDto {
  @ApiPropertyOptional({ example: '전공', maxLength: 10 })
  @ValidateIf(
    (dto: UpdateFolderDto) =>
      dto.folderTitle !== undefined || dto.color === undefined,
  )
  @IsDefined({ message: 'folderTitle 또는 color 중 하나는 필수입니다.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '폴더 이름은 필수입니다.' })
  @MaxLength(10, { message: '폴더 이름은 최대 10자까지만 가능합니다.' })
  folderTitle?: string;

  @ApiPropertyOptional({ enum: ALLOWED_COLORS, example: '#F55757' })
  @IsOptional()
  @Transform(trimUpper)
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/, {
    message: '색상은 #을 포함한 7자리 Hex 코드여야 합니다.',
  })
  @IsIn(ALLOWED_COLORS, { message: '허용되지 않는 색상입니다.' })
  color?: string;
}

export class DeleteFolderQueryDto {
  // 'true'일 때만 과제를 옮기고, 그 외 값은 false로 본다.
  @ApiPropertyOptional({
    description: "true면 폴더 안의 과제를 '지정안함' 폴더로 옮기고 삭제",
    default: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  moveTasks: boolean = false;
}

export class FolderRankDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  folderId: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  rank: number;
}

export class UpdateFolderPriorityDto {
  @ApiProperty({ type: [FolderRankDto] })
  @IsArray({ message: '순서 변경 데이터가 올바르지 않습니다.' })
  @ValidateNested({ each: true })
  @Type(() => FolderRankDto)
  orderedFolders: FolderRankDto[];
}

// ===== 응답관련 DTO =====

// 폴더 생성·수정
export class FolderResponseDto {
  @ApiProperty() folderId: number;
  @ApiProperty() userId: number;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ example: '#F55757' }) color: string;

  static from(folder: Folder): FolderResponseDto {
    const dto = new FolderResponseDto();
    dto.folderId = folder.id;
    dto.userId = folder.userId;
    dto.folderTitle = folder.folderTitle;
    dto.color = folder.color;
    return dto;
  }
}

// 폴더 상세 조회 — 폴더 정보
export class FolderInfoResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() userId: number;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ example: '#F55757' }) color: string;
  @ApiProperty() rank: number;
  @ApiProperty({ example: '2026-10-20T23:59:00.000+09:00' }) createdAt: Date;

  static from(folder: Folder): FolderInfoResponseDto {
    const dto = new FolderInfoResponseDto();
    dto.id = folder.id;
    dto.userId = folder.userId;
    dto.folderTitle = folder.folderTitle;
    dto.color = folder.color;
    dto.rank = folder.rank;
    dto.createdAt = folder.createdAt;
    return dto;
  }
}

// 폴더 상세 조회 — 세부 과제
export class FolderSubTaskResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() taskId: number;
  @ApiProperty() title: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endDate: Date | null;
  @ApiProperty({ enum: SubTaskStatus }) status: SubTaskStatus;
  @ApiProperty() isAlarm: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;

  static from(subTask: SubTask): FolderSubTaskResponseDto {
    const dto = new FolderSubTaskResponseDto();
    dto.id = subTask.id;
    dto.taskId = subTask.taskId;
    dto.title = subTask.title;
    dto.endDate = subTask.endDate;
    dto.status = subTask.status;
    dto.isAlarm = subTask.isAlarm;
    dto.createdAt = subTask.createdAt;
    dto.updatedAt = subTask.updatedAt;
    return dto;
  }
}

// 폴더 상세 조회 — 과제
export class FolderTaskResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() title: string;
  @ApiProperty({ type: String, format: 'date-time' }) deadline: Date;
  @ApiProperty({ enum: TaskType }) type: TaskType;
  @ApiProperty({ enum: TaskStatus }) status: TaskStatus;
  @ApiProperty() isAlarm: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;
  @ApiProperty({ type: String, nullable: true }) inviteCode: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  inviteExpiredAt: Date | null;
  @ApiProperty({
    example: 'D-3',
    description: "KST 날짜 기준 ('D-Day', 'D-3', 'D+2')",
  })
  dDay: string;
  @ApiProperty({ type: [FolderSubTaskResponseDto] })
  subTasks: FolderSubTaskResponseDto[];

  /**
   * @param task subTasks 관계를 함께 조회한 과제
   * @param now D-Day 계산 기준 시각
   */
  static from(task: Task, now: Date): FolderTaskResponseDto {
    const dto = new FolderTaskResponseDto();
    dto.id = task.id;
    dto.title = task.title;
    dto.deadline = task.deadline;
    dto.type = task.type;
    dto.status = task.status;
    dto.isAlarm = task.isAlarm;
    dto.createdAt = task.createdAt;
    dto.updatedAt = task.updatedAt;
    dto.inviteCode = task.inviteCode;
    dto.inviteExpiredAt = task.inviteExpiredAt;
    dto.dDay = toDDay(task.deadline, now);
    dto.subTasks = task.subTasks.map((subTask) =>
      FolderSubTaskResponseDto.from(subTask),
    );
    return dto;
  }
}

// 폴더 상세 조회
export class FolderDetailResponseDto {
  @ApiProperty({ type: FolderInfoResponseDto })
  folderInfo: FolderInfoResponseDto;
  @ApiProperty({ type: [FolderTaskResponseDto] })
  tasks: FolderTaskResponseDto[];

  /**
   * @param tasks 이 폴더에 들어 있는 마감 전 과제 (마감일 오름차순)
   * @param now D-Day 계산 기준 시각
   */
  static from(
    folder: Folder,
    tasks: Task[],
    now: Date,
  ): FolderDetailResponseDto {
    const dto = new FolderDetailResponseDto();
    dto.folderInfo = FolderInfoResponseDto.from(folder);
    dto.tasks = tasks.map((task) => FolderTaskResponseDto.from(task, now));
    return dto;
  }
}
