import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

// 전역 Access Token 검증(JwtStrategy)을 등록한다. 토큰 발급은 auth 도메인이 담당한다.
@Global()
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
})
export class JwtAuthModule {}
