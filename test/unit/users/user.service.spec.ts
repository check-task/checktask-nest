import { Repository } from 'typeorm';
import { CustomError } from '../../../src/common/response/error/custom.error';
import { UserAlarmSetting } from '../../../src/users/entities/user-alarm-setting.entity';
import { User } from '../../../src/users/entities/user.entity';
import { UserService } from '../../../src/users/user.service';

describe('UserService', () => {
  const userRepository = { exists: vi.fn(), findOne: vi.fn() };
  const settingRepository = { find: vi.fn() };
  const service = new UserService(
    userRepository as unknown as Repository<User>,
    settingRepository as unknown as Repository<UserAlarmSetting>,
  );

  beforeEach(() => vi.clearAllMocks());

  it('사용자가 없으면 USER_NOT_FOUND', async () => {
    userRepository.exists.mockResolvedValue(false);
    const error = await service.assertUserExists(1).catch((e: unknown) => e);
    expect((error as CustomError).errorCode).toBe('USER_NOT_FOUND');
  });

  it('알림 설정은 유저별 Map으로 주고, 빈 목록이면 조회하지 않는다', async () => {
    expect(await service.getAlarmHours([])).toEqual(new Map());
    expect(settingRepository.find).not.toHaveBeenCalled();

    settingRepository.find.mockResolvedValue([
      { userId: 1, deadlineAlarm: 12, taskAlarm: 6 },
    ]);
    const hours = await service.getAlarmHours([1, 1, 2]);
    expect(hours.get(1)).toMatchObject({ deadlineAlarm: 12, taskAlarm: 6 });
    expect(hours.has(2)).toBe(false);
  });
});
