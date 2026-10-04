import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { AuthModule } from './auth/auth.module';
import { JwtAuthModule } from './common/auth/jwt-auth.module';
import { dataSourceOptions } from './common/database/data-source';
import { RedisModule } from './common/redis/redis.module';
import { S3Module } from './common/s3/s3.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: dataSourceOptions,
      inject: [ConfigService],
      imports: undefined
    }),
    JwtAuthModule,
    // AuthModule,
    RedisModule,
    S3Module,
    HealthModule,
  ],
})
export class AppModule {}
