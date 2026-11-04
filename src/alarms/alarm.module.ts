import { Module } from '@nestjs/common';
import { AlarmService } from './alarm.service';

@Module({
  providers: [AlarmService],
  exports: [AlarmService],
})
export class AlarmModule {}
