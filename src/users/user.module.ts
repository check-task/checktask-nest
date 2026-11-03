import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAlarmSetting } from './entities/user-alarm-setting.entity';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserAlarmSetting])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
