import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../tasks/entities/member.entity';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { AlarmController } from './alarm.controller';
import { UserAlarm } from './alarm.entity';
import { AlarmScheduler } from './alarm.scheduler';
import { AlarmService } from './alarm.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAlarm, User, Task, SubTask, Member])],
  controllers: [AlarmController],
  providers: [AlarmService, AlarmScheduler],
  exports: [AlarmService], // tasks 도메인에서 알림 생성·수정 함수를 쓴다
})
export class AlarmModule {}
