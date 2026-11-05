import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmModule } from './alarms/alarm.module';
// import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './common/auth/jwt-auth.module';
import { validateEnv } from './common/config/env.validation';
import { dataSourceOptions } from './common/database/data-source';
import { FcmModule } from './common/fcm/fcm.module';
import { MailModule } from './common/mail/mail.module';
import { RedisModule } from './common/redis/redis.module';
import { S3Module } from './common/s3/s3.module';
import { FolderModule } from './folders/folder.module';
import { HealthModule } from './health/health.module';
import { ReferenceModule } from './references/reference.module';
import { TaskModule } from './tasks/task.module';
import { UserModule } from './users/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      useFactory: dataSourceOptions,
      inject: [ConfigService],
    }),
    JwtAuthModule,
    // AuthModule,
    RedisModule,
    S3Module,
    FcmModule,
    MailModule,
    ScheduleModule.forRoot(), // cron (alarms/alarm.scheduler.ts)
    HealthModule,
    UserModule,
    FolderModule,
    AlarmModule,
    ReferenceModule,
    TaskModule,
  ],
})
export class AppModule {}
