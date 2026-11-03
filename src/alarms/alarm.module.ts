import { Module } from '@nestjs/common';
import { UserModule } from '../users/user.module';
import { AlarmService } from './alarm.service';

@Module({
  imports: [UserModule],
  providers: [AlarmService],
  exports: [AlarmService],
})
export class AlarmModule {}
