import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// 사용자 이름 읽기 데코레이터
export interface UserPayload {
  id: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserPayload =>
    ctx.switchToHttp().getRequest().user,
);
