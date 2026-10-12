import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../../../../../src/common/response/error/custom.error';
import { JwtAuthGuard } from '../../../../../src/common/auth/guards/jwt-auth.guard';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const expired = Object.assign(new Error('jwt expired'), {
    name: 'TokenExpiredError',
  });
  const invalid = Object.assign(new Error('invalid signature'), {
    name: 'JsonWebTokenError',
  });

  const errorCodeOf = (info: unknown) => {
    try {
      guard.handleRequest(null, false, info);
    } catch (e) {
      expect(e).toBeInstanceOf(UnauthorizedError);
      return (e as UnauthorizedError).errorCode;
    }
    throw new Error('예외가 발생하지 않음');
  };

  it('검증된 사용자는 그대로 반환한다', () => {
    const user = { id: 1 };
    expect(guard.handleRequest(null, user, undefined)).toBe(user);
  });

  it('토큰이 없으면 TOKEN_NOT_FOUND', () => {
    expect(errorCodeOf(new Error('No auth token'))).toBe('TOKEN_NOT_FOUND');
  });

  it('토큰이 만료되면 TOKEN_EXPIRED', () => {
    expect(errorCodeOf(expired)).toBe('TOKEN_EXPIRED');
  });

  it('그 외 검증 실패는 UNAUTHORIZED', () => {
    expect(errorCodeOf(invalid)).toBe('UNAUTHORIZED');
  });
});
