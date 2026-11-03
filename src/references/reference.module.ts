import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Communication } from './entities/communication.entity';
import { Log } from './entities/log.entity';
import { Reference } from './entities/reference.entity';
import { ReferenceService } from './reference.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reference, Log, Communication])],
  providers: [ReferenceService],
  exports: [ReferenceService],
})
export class ReferenceModule {}
