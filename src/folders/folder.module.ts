import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Member } from '../tasks/entities/member.entity';
import { FolderController } from './folder.controller';
import { Folder } from './folder.entity';
import { FolderService } from './folder.service';

@Module({
  // Member: 폴더 삭제 시 과제 이동, 폴더 상세 조회의 과제 목록
  imports: [TypeOrmModule.forFeature([Folder, Member])],
  controllers: [FolderController],
  providers: [FolderService],
})
export class FolderModule {}
