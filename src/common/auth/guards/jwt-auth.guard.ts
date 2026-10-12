import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UnauthorizedError } from '../../response/error/custom.error';

//전역 인증 가드. @Public() 라우트는 인증을 건너뛴다.
//검사를 할 지 말 지 결정한다.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }

  /**
   * 토큰 검증 실패 원인(info)에 따라 errorCode를 나눠서 던진다.
   * @throws UnauthorizedError(TOKEN_NOT_FOUND) - Authorization 헤더에 토큰이 없을 때
   * @throws UnauthorizedError(TOKEN_EXPIRED) - 토큰이 만료됐을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 서명 불일치·형식 오류 등 그 외 검증 실패
   */
  handleRequest<TUser>(
    err: unknown,
    user: TUser | false,
    info: unknown,
  ): TUser {
    if (err) throw err;
    if (user) return user;

    // passport-jwt는 토큰이 없으면 'No auth token', 만료면 jsonwebtoken의 TokenExpiredError를 info로 넘긴다
    // reason은 레거시(authenticate 미들웨어)와 같은 문구를 쓴다
    if (info instanceof Error) {
      if (info.message === 'No auth token') {
        throw new UnauthorizedError('TOKEN_NOT_FOUND', '인증 토큰이 없습니다.');
      }
      if (info.name === 'TokenExpiredError') {
        throw new UnauthorizedError('TOKEN_EXPIRED', '토큰이 만료되었습니다.');
      }
    }
    throw new UnauthorizedError('UNAUTHORIZED', '토큰이 유효하지 않습니다.');
  }
}
