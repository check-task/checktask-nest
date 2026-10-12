import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Provider } from '../../enums';
import { UnauthorizedError } from '../../response/error/custom.error';
import { UserPayload } from '../decorators/current-user.decorator';

/**
 * Access Token payload. 레거시(checktask-back)와 같은 형태라 기존에 발급된 토큰도 그대로 검증된다.
 * auth 도메인에서 토큰을 발급할 때도 이 타입을 사용한다.
 */
export interface AccessTokenPayload {
  id: number;
  provider: Provider | null; // 소셜 로그인이 아니면 null
  providerId: string | null;
}

//실제로 서명과 만료를 확인 한다.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * 검증된 토큰 payload를 request.user에 담길 형태로 변환한다.
   * @throws UnauthorizedError(UNAUTHORIZED) - payload에 정수 id가 없을 때
   */
  validate(payload: Partial<AccessTokenPayload>): UserPayload {
    if (!Number.isInteger(payload.id)) {
      throw new UnauthorizedError('UNAUTHORIZED', '유효하지 않은 토큰입니다.');
    }
    return { id: payload.id as number };
  }
}
