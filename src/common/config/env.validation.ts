import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

const isProduction = (env: EnvironmentVariables) =>
  env.NODE_ENV === 'production';

/**
 * 필수 환경 변수 목록. 하나라도 없거나 빈 값이면 서버가 뜨지 않는다.
 * 새 환경 변수를 추가하면 여기·.env.example·docs/COMMON.md 환경 변수 표에 함께 추가한다.
 */
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  // ===== database =====
  @IsString() @IsNotEmpty() DB_HOST: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) DB_PORT?: number;
  @IsString() @IsNotEmpty() DB_USERNAME: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;
  @IsString() @IsNotEmpty() DB_DATABASE: string;

  // ===== redis =====
  @IsString() @IsNotEmpty() REDIS_HOST: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) REDIS_PORT?: number;

  // ===== s3 (키를 비우면 IAM Role 사용) =====
  @IsString() @IsNotEmpty() AWS_REGION: string;
  @IsString() @IsNotEmpty() AWS_S3_BUCKET: string;

  // ===== auth =====
  @IsString() @IsNotEmpty() JWT_SECRET: string;

  // ===== fcm =====
  @IsString() @IsNotEmpty() FIREBASE_PROJECT_ID: string;
  @IsString() @IsNotEmpty() FIREBASE_CLIENT_EMAIL: string;
  @IsString() @IsNotEmpty() FIREBASE_PRIVATE_KEY: string;

  // ===== mail =====
  @IsString() @IsNotEmpty() EMAIL_USER: string;
  @IsString() @IsNotEmpty() EMAIL_PASSWORD: string;

  // ===== swagger (운영에서만 필수) =====
  @ValidateIf(isProduction) @IsString() @IsNotEmpty() SWAGGER_USER?: string;
  @ValidateIf(isProduction) @IsString() @IsNotEmpty() SWAGGER_PASSWORD?: string;
}

/**
 * ConfigModule.forRoot({ validate })에 넘겨 서버 시작 시 환경 변수를 검사한다.
 * 문제가 있는 변수를 한 번에 모두 알려준다.
 * @throws Error - 필수 값이 없거나 빈 값·형식 오류일 때
 */
export const validateEnv = (
  config: Record<string, unknown>,
): Record<string, unknown> => {
  // .env 값은 모두 문자열이므로 숫자 필드(PORT 등)는 변환해서 검사한다
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const invalid = errors.map((error) => `- ${error.property}`).join('\n');
    throw new Error(
      `환경 변수가 없거나 올바르지 않습니다. .env를 확인하세요.\n${invalid}`,
    );
  }
  return config;
};
