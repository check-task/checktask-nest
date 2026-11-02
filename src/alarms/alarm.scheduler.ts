import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { AlarmService } from './alarm.service';

// PM2 cluster의 모든 인스턴스가 같은 cron을 실행하므로, 락을 잡은 인스턴스 하나만 발송한다
export const ALARM_PUSH_LOCK_KEY = 'lock:alarm_push';
// 실행 주기(5분)보다 짧게 잡아 다음 주기에는 다시 실행되게 한다
export const ALARM_PUSH_LOCK_TTL_SECONDS = 4 * 60;

@Injectable()
export class AlarmScheduler {
  constructor(
    private readonly alarmService: AlarmService,
    private readonly redisService: RedisService,
  ) {}

  // 5분마다 알림 시각이 된 마감 알림을 푸시로 보낸다
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueAlarms() {
    const locked = await this.redisService.setIfNotExists(
      ALARM_PUSH_LOCK_KEY,
      '1',
      ALARM_PUSH_LOCK_TTL_SECONDS,
    );
    if (!locked) return;
    await this.alarmService.sendDueAlarms();
  }
}
