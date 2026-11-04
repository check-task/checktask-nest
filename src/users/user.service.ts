import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlarmService } from '../alarms/alarm.service';
import { NotFoundError } from '../common/response/error/custom.error';
import { S3Service } from '../common/s3/s3.service';
import { Folder } from '../folders/folder.entity';
import { UserAlarmSetting } from './entities/user-alarm-setting.entity';
import { User } from './entities/user.entity';
import {
  GetProfileImageUploadUrlDto,
  PROFILE_IMAGE_DIR,
  ProfileImageUploadUrlResponseDto,
  UpdateProfileDto,
  UserInfoResponseDto,
  UserProfileResponseDto,
} from './user.dto';

// 값이 undefined인 키를 뺌
const omitUndefined = <T extends object>(obj: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAlarmSetting)
    private readonly userAlarmSettingRepository: Repository<UserAlarmSetting>,
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
    private readonly alarmService: AlarmService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * 내 정보 조회 (알림 설정 및 폴더 목록 포함)
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   */
  async getMyInfo(userId: number): Promise<UserInfoResponseDto> {
    // 레거시와 같이 탈퇴한 사용자도 조회한다
    const [user, alarmSetting, folders] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        withDeleted: true,
      }),
      this.userAlarmSettingRepository.findOneBy({ userId }),
      this.folderRepository.find({
        where: { userId },
        order: { rank: 'ASC', id: 'ASC' },
      }),
    ]);
    if (!user) {
      throw new NotFoundError(
        'USER_NOT_FOUND',
        '해당 사용자를 찾을 수 없습니다.',
      );
    }

    const profileImageUrl = await this.getProfileImageUrl(user.profileImage);
    return UserInfoResponseDto.from(
      user,
      alarmSetting,
      folders,
      profileImageUrl,
    );
  }

  /**
   * 프로필 이미지 업로드용 Presigned URL 발급
   * 클라이언트는 url로 S3에 직접 업로드한 뒤, key를 프로필 수정 API의 profileImageKey로 보낸다.
   */
  async getProfileImageUploadUrl(
    dto: GetProfileImageUploadUrlDto,
  ): Promise<ProfileImageUploadUrlResponseDto> {
    const upload = await this.s3Service.getUploadUrl(
      PROFILE_IMAGE_DIR,
      dto.fileName,
      dto.contentType,
    );
    return ProfileImageUploadUrlResponseDto.from(upload);
  }

  /**
   * 프로필 수정 (닉네임·연락처·이메일·프로필 이미지)
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없거나 탈퇴했을 때
   */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      withDeleted: true,
    });
    if (!user) {
      throw new NotFoundError(
        'USER_NOT_FOUND',
        '해당 사용자를 찾을 수 없습니다.',
      );
    }
    if (user.deletedAt) {
      throw new NotFoundError('USER_NOT_FOUND', '탈퇴한 사용자입니다.');
    }

    const userFields = omitUndefined({
      nickname: dto.nickname,
      phoneNum: dto.phoneNum,
      email: dto.email,
      profileImage: dto.profileImageKey,
    });
    const hasUserUpdate = Object.keys(userFields).length > 0;
    const hasAlarmUpdate =
      dto.deadlineAlarm !== undefined || dto.taskAlarm !== undefined;

    // 바꿀 값이 없으면 현재 정보를 그대로 반환한다
    if (!hasUserUpdate && !hasAlarmUpdate) {
      const profileImageUrl = await this.getProfileImageUrl(user.profileImage);
      return UserProfileResponseDto.from(user, profileImageUrl);
    }

    if (hasUserUpdate) {
      await this.userRepository.update({ id: userId }, userFields);
    }
    // 알림 시간 저장과 함께 대기 중인 알림의 발송 시각 및 제목을 다시 계산한다
    if (dto.deadlineAlarm !== undefined) {
      await this.alarmService.updateDeadlineAlarm(userId, dto.deadlineAlarm);
    }
    if (dto.taskAlarm !== undefined) {
      await this.alarmService.updateTaskAlarm(userId, dto.taskAlarm);
    }

    const updatedUser = await this.userRepository.findOneByOrFail({
      id: userId,
    });
    const profileImageUrl = await this.getProfileImageUrl(
      updatedUser.profileImage,
    );
    return UserProfileResponseDto.from(updatedUser, profileImageUrl);
  }

  /**
   * DB의 profile_image를 응답용 URL로 바꾼다.
   * 레거시 데이터는 전체 URL, 이관 후 데이터는 S3 key가 저장되어 있다.
   */
  private async getProfileImageUrl(
    profileImage: string | null,
  ): Promise<string | null> {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return this.s3Service.getDownloadUrl(profileImage);
  }
}
