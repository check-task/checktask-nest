import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../tasks/entities/member.entity';
import { Task } from '../tasks/entities/task.entity';
import { Communication } from './entities/communication.entity';
import { Log } from './entities/log.entity';
import { Reference } from './entities/reference.entity';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reference,
      Log,
      Communication,
      Task,
      Member,
    ]),
  ],
  controllers: [ReferenceController],
  providers: [ReferenceService],
  exports: [ReferenceService],
})
export class ReferenceModule {}
