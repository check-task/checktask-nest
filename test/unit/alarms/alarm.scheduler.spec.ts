import {
  ALARM_PUSH_LOCK_KEY,
  AlarmScheduler,
} from '../../../src/alarms/alarm.scheduler';
import { AlarmService } from '../../../src/alarms/alarm.service';
import { RedisService } from '../../../src/common/redis/redis.service';

describe('AlarmScheduler', () => {
  const alarmService = { sendDueAlarms: vi.fn() };
  const redisService = { setIfNotExists: vi.fn() };
  const scheduler = new AlarmScheduler(
    alarmService as unknown as AlarmService,
    redisService as unknown as RedisService,
  );

  beforeEach(() => vi.clearAllMocks());

  it('락을 잡은 인스턴스만 발송한다', async () => {
    redisService.setIfNotExists.mockResolvedValue(true);
    await scheduler.sendDueAlarms();
    expect(redisService.setIfNotExists).toHaveBeenCalledWith(
      ALARM_PUSH_LOCK_KEY,
      '1',
      expect.any(Number),
    );
    expect(alarmService.sendDueAlarms).toHaveBeenCalled();
  });

  it('다른 인스턴스가 락을 잡았으면 발송하지 않는다', async () => {
    redisService.setIfNotExists.mockResolvedValue(false);
    await scheduler.sendDueAlarms();
    expect(alarmService.sendDueAlarms).not.toHaveBeenCalled();
  });
});
