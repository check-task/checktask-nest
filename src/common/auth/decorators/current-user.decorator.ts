import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// 인증된 사용자 정보 (JwtStrategy.validate()의 반환값)
export interface UserPayload {
  id: number; // 기존 DB의 user_id(정수)
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload =>
    ctx.switchToHttp().getRequest().user,
);
