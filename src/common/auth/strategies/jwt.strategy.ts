import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserPayload } from '../decorators/current-user.decorator';

//실제로 서명과 만료를 확인 한다.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // 검증된 토큰 payload를 request.user에 담길 형태로 변환한다.
  validate(payload: { sub: string; email: string }): UserPayload {
    return { id: payload.sub, email: payload.email };
  }
}
