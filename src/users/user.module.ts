import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmModule } from '../alarms/alarm.module';
import { Folder } from '../folders/folder.entity';
import { UserAgreement } from './entities/user-agreement.entity';
import { UserAlarmSetting } from './entities/user-alarm-setting.entity';
import { UserDevice } from './entities/user-device.entity';
import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      UserAlarmSetting,
      UserAgreement,
      Folder, // 내 정보 조회의 폴더 목록
    ]),
    AlarmModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
