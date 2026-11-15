import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * TODO: 토큰 발급 구현 시 추가
 * - imports: JwtModule.register({}) — secret·expiresIn은 발급 시점에 Access/Refresh 별로 지정
 *            TypeOrmModule.forFeature([RefreshToken, User])
 * - providers: JwtRefreshStrategy
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
