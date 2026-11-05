import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Provider } from '../common/enums';
import { Folder } from '../folders/folder.entity';
import {
  DEFAULT_ALARM_HOURS,
  UserAlarmSetting,
} from './entities/user-alarm-setting.entity';
import { User } from './entities/user.entity';

// 프로필 이미지로 업로드할 수 있는 형식
export const PROFILE_IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png'];

// 프로필 이미지 S3 저장 경로
export const PROFILE_IMAGE_DIR = 'profile';

// 앞뒤 공백 제거 (문자열이 아니면 그대로 두고 검증에서 걸러낸다)
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ===== 요청 =====

// 프로필 이미지 업로드 URL 발급
export class GetProfileImageUploadUrlDto {
  @ApiProperty({ example: 'profile.png' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ enum: PROFILE_IMAGE_CONTENT_TYPES, example: 'image/png' })
  @IsIn(PROFILE_IMAGE_CONTENT_TYPES)
  contentType: string;
}

/**
 * 프로필 수정 (보내지 않는 필드는 수정하지 않음)
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '체크태스크', maxLength: 30 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30, { message: '닉네임은 최대 30자까지만 가능합니다.' })
  nickname?: string;

  @ApiPropertyOptional({ example: '010-1234-5678', maxLength: 20 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const trimmed = trim({ value });
    return trimmed === '' ? undefined : trimmed;
  })
  @IsString()
  @MaxLength(20)
  phoneNum?: string;

  @ApiPropertyOptional({ example: 'user@checktask.kr', maxLength: 50 })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @MaxLength(50)
  email?: string;

  // 업로드 URL 발급 API가 돌려준 key. 다른 경로의 파일을 지정하지 못하게 형식을 고정한다.
  @ApiPropertyOptional({
    description: '프로필 이미지 업로드 URL 발급 시 받은 key',
    example: 'profile/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.png',
  })
  @IsOptional()
  @IsString()
  @Matches(/^profile\/[0-9a-f-]{36}(\.[a-z0-9]+)?$/, {
    message: '올바른 프로필 이미지 key가 아닙니다.',
  })
  profileImageKey?: string;

  @ApiPropertyOptional({
    description: '최종 마감 알림 시간 (마감 N시간 전)',
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  deadlineAlarm?: number;

  @ApiPropertyOptional({
    description: '과제별 알림 시간 (마감 N시간 전)',
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskAlarm?: number;
}

// ===== 응답관련 DTO =====

// 프로필 이미지 업로드 URL 발급
export class ProfileImageUploadUrlResponseDto {
  @ApiProperty({
    description: '프로필 수정 시 profileImageKey로 보낼 값',
    example: 'profile/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.png',
  })
  key: string;

  @ApiProperty({
    description:
      '이 URL로 PUT 업로드 (요청 때와 같은 Content-Type 헤더 필수, 5분 유효)',
  })
  url: string;

  static from(upload: {
    key: string;
    url: string;
  }): ProfileImageUploadUrlResponseDto {
    const dto = new ProfileImageUploadUrlResponseDto();
    dto.key = upload.key;
    dto.url = upload.url;
    return dto;
  }
}

// 내 정보 조회에 포함되는 폴더 요약
export class UserFolderResponseDto {
  @ApiProperty() folderId: number;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ example: '#FF5733' }) color: string;

  static from(folder: Folder): UserFolderResponseDto {
    const dto = new UserFolderResponseDto();
    dto.folderId = folder.id;
    dto.folderTitle = folder.folderTitle;
    dto.color = folder.color;
    return dto;
  }
}

// 내 정보 조회
export class UserInfoResponseDto {
  @ApiProperty() userId: number;
  @ApiProperty() nickname: string;
  @ApiProperty() phoneNum: string;
  @ApiProperty() email: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: '프로필 이미지 조회 URL',
  })
  profileImage: string | null;
  @ApiProperty({
    enum: [...Object.values(Provider), 'LOCAL'],
    description: '소셜 로그인이 아니면 LOCAL',
  })
  loginType: Provider | 'LOCAL';
  @ApiProperty({ example: 24 }) deadlineAlarm: number;
  @ApiProperty({ example: 24 }) taskAlarm: number;
  @ApiProperty({ type: [UserFolderResponseDto] })
  folders: UserFolderResponseDto[];

  /**
   * @param alarmSetting 사용자의 알림 설정 (없으면 기본값 24시간)
   * @param folders 사용자의 폴더 목록 (rank, id 오름차순)
   * @param profileImageUrl 저장된 이미지 key로 발급한 조회 URL
   */
  static from(
    user: User,
    alarmSetting: UserAlarmSetting | null,
    folders: Folder[],
    profileImageUrl: string | null,
  ): UserInfoResponseDto {
    const dto = new UserInfoResponseDto();
    dto.userId = user.id;
    dto.nickname = user.nickname;
    dto.phoneNum = user.phoneNum;
    dto.email = user.email;
    dto.profileImage = profileImageUrl;
    dto.loginType = user.provider ?? 'LOCAL';
    dto.deadlineAlarm = alarmSetting?.deadlineAlarm ?? DEFAULT_ALARM_HOURS;
    dto.taskAlarm = alarmSetting?.taskAlarm ?? DEFAULT_ALARM_HOURS;
    dto.folders = folders.map((folder) => UserFolderResponseDto.from(folder));
    return dto;
  }
}

// 프로필 수정
export class UserProfileResponseDto {
  @ApiProperty() userId: number;
  @ApiProperty() nickname: string;
  @ApiProperty() phoneNum: string;
  @ApiProperty() email: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: '프로필 이미지 조회 URL',
  })
  profileImage: string | null;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-20T23:59:00.000+09:00',
  })
  updatedAt: Date | null;

  /**
   * @param profileImageUrl 저장된 이미지 key로 발급한 조회 URL
   */
  static from(
    user: User,
    profileImageUrl: string | null,
  ): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.userId = user.id;
    dto.nickname = user.nickname;
    dto.phoneNum = user.phoneNum;
    dto.email = user.email;
    dto.profileImage = profileImageUrl;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
