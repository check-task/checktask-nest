import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// RedisService를 전역 단일 커넥션으로 제공한다.
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
