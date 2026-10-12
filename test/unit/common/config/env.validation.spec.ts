import 'reflect-metadata';
import { validateEnv } from '../../../../src/common/config/env.validation';

const REQUIRED = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'pw',
  DB_DATABASE: 'Check_Task_DB',
  REDIS_HOST: 'localhost',
  AWS_REGION: 'ap-northeast-2',
  AWS_S3_BUCKET: 'checktask',
  JWT_SECRET: 'secret',
  FIREBASE_PROJECT_ID: 'checktask',
  FIREBASE_CLIENT_EMAIL: 'fcm@checktask.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: 'key',
  EMAIL_USER: 'checktask@gmail.com',
  EMAIL_PASSWORD: 'pw',
};

describe('validateEnv', () => {
  it('필수 값이 모두 있으면 통과하고 값을 그대로 반환한다', () => {
    const env = { ...REQUIRED, PORT: '8000', DB_PORT: '5432' };
    expect(validateEnv(env)).toBe(env);
  });

  it('필수 값이 없거나 빈 문자열이면 해당 변수를 모두 알려주며 실패한다', () => {
    const env: Record<string, unknown> = { ...REQUIRED, EMAIL_USER: '' };
    delete env.JWT_SECRET;
    expect(() => validateEnv(env)).toThrow(
      /- JWT_SECRET[\s\S]*- EMAIL_USER|- EMAIL_USER[\s\S]*- JWT_SECRET/,
    );
  });

  it('포트가 숫자가 아니면 실패한다', () => {
    expect(() => validateEnv({ ...REQUIRED, DB_PORT: 'abc' })).toThrow(
      /DB_PORT/,
    );
  });

  it('SWAGGER 계정은 운영에서만 필수다', () => {
    expect(() =>
      validateEnv({ ...REQUIRED, NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'production' })).toThrow(
      /SWAGGER_USER[\s\S]*SWAGGER_PASSWORD/,
    );
    expect(() =>
      validateEnv({
        ...REQUIRED,
        NODE_ENV: 'production',
        SWAGGER_USER: 'a',
        SWAGGER_PASSWORD: 'b',
      }),
    ).not.toThrow();
  });

  it('NODE_ENV는 정해진 값만 허용한다', () => {
    expect(() => validateEnv({ ...REQUIRED, NODE_ENV: 'prod' })).toThrow(
      /NODE_ENV/,
    );
  });
});
