import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmModule } from '../alarms/alarm.module';
import { FolderModule } from '../folders/folder.module';
import { ReferenceModule } from '../references/reference.module';
import { UserModule } from '../users/user.module';
import { Member } from './entities/member.entity';
import { SubTask } from './entities/sub-task.entity';
import { TaskPriority } from './entities/task-priority.entity';
import { Task } from './entities/task.entity';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, SubTask, Member, TaskPriority]),
    UserModule,
    FolderModule,
    AlarmModule,
    ReferenceModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
