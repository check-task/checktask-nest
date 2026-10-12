import { ConfigService } from '@nestjs/config';
import { UnauthorizedError } from '../../../../../src/common/response/error/custom.error';
import { JwtStrategy } from '../../../../../src/common/auth/strategies/jwt.strategy';

describe('JwtStrategy.validate', () => {
  const strategy = new JwtStrategy(
    new ConfigService({ JWT_SECRET: 'test-secret' }),
  );

  it('레거시 payload { id, provider, providerId }에서 id를 꺼낸다', () => {
    expect(
      strategy.validate({ id: 1, provider: null, providerId: null }),
    ).toEqual({ id: 1 });
  });

  it('id가 정수가 아니면 UnauthorizedError', () => {
    expect(() => strategy.validate({})).toThrow(UnauthorizedError);
    expect(() => strategy.validate({ id: '1' as unknown as number })).toThrow(
      UnauthorizedError,
    );
  });
});
