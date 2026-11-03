import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { NotFoundError } from '../common/response/error/custom.error';
import { UserAlarmSetting } from './entities/user-alarm-setting.entity';
import { User } from './entities/user.entity';

// 알림 설정이 없는 유저의 기본값 (마감 N시간 전)
export const DEFAULT_ALARM_HOURS = 24;

export type AlarmHours = Pick<UserAlarmSetting, 'deadlineAlarm' | 'taskAlarm'>;

/**
 * users 도메인 Service.
 * 지금은 다른 도메인(tasks·alarms)이 쓰는 조회만 있다. 유저 API는 users 도메인 이관 때 추가한다.
 */
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserAlarmSetting)
    private readonly userAlarmSettingRepository: Repository<UserAlarmSetting>,
  ) {}

  /**
   * @throws NotFoundError(USER_NOT_FOUND) - 사용자가 없을 때
   */
  async assertUserExists(userId: number): Promise<void> {
    const exists = await this.userRepository.exists({ where: { id: userId } });
    if (!exists) {
      throw new NotFoundError(
        'USER_NOT_FOUND',
        '해당 사용자를 찾을 수 없습니다.',
      );
    }
  }

  /** 닉네임 조회 (없으면 null). 트랜잭션 안에서 부르면 manager를 넘긴다 */
  async getNickname(
    userId: number,
    manager?: EntityManager,
  ): Promise<string | null> {
    const repository = manager?.getRepository(User) ?? this.userRepository;
    const user = await repository.findOne({
      where: { id: userId },
      select: { id: true, nickname: true },
    });
    return user?.nickname ?? null;
  }

  /** 유저별 알림 설정 (설정이 없는 유저는 Map에 없음 → 호출한 쪽에서 DEFAULT_ALARM_HOURS 사용) */
  async getAlarmHours(
    userIds: number[],
    manager?: EntityManager,
  ): Promise<Map<number, AlarmHours>> {
    if (userIds.length === 0) return new Map();
    const repository =
      manager?.getRepository(UserAlarmSetting) ??
      this.userAlarmSettingRepository;
    const settings = await repository.find({
      where: { userId: In([...new Set(userIds)]) },
      select: { userId: true, deadlineAlarm: true, taskAlarm: true },
    });
    return new Map(settings.map((setting) => [setting.userId, setting]));
  }
}
