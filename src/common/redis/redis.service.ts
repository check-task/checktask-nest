import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get('REDIS_HOST'),
      port: config.get<number>('REDIS_PORT'),
      password: config.get('REDIS_PASSWORD') || undefined,
    });
  }

  // 값을 저장한다. ttlSeconds를 주면 해당 초 뒤 만료된다.
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
    else await this.client.set(key, value);
  }

  get(key: string) {
    return this.client.get(key);
  }

  async del(key: string) {
    await this.client.del(key);
  }

  // 키 값을 1 증가시키고, 처음 생성된 키라면 만료 시간을 건다. (일일 횟수 제한용)
  async incr(key: string, ttlSeconds?: number) {
    const count = await this.client.incr(key);
    if (count === 1 && ttlSeconds) await this.client.expire(key, ttlSeconds);
    return count;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
