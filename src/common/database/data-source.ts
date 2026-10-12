import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { defaults, types } from 'pg';
import { DataSourceOptions } from 'typeorm';

/**
 * 기존 DB의 시간 컬럼은 `timestamp`(time zone 없음)라서, pg 드라이버는 기본적으로 서버 프로세스의 로컬 시간대로 읽고 쓴다.
 * 서버 시간대(TZ)에 따라 값이 달라지지 않도록 항상 UTC로 읽고 쓰게 고정한다.
 */
export const parseTimestampAsUtc = (value: string): Date =>
  new Date(`${value.replace(' ', 'T')}Z`);
types.setTypeParser(types.builtins.TIMESTAMP, parseTimestampAsUtc);
defaults.parseInputDatesAsUTC = true;

/**
 * 운영(RDS)은 SSL로 접속하고, 로컬은 SSL 없이 접속한다.
 * DB_SSL_CA에 RDS 인증서 번들 경로를 주면 서버 인증서까지 검증하고, 없으면 암호화만 한다.
 */
const buildSslOptions = (env: (key: string) => string | undefined) => {
  if (env('NODE_ENV') !== 'production') return false;
  const caPath = env('DB_SSL_CA');
  return caPath
    ? { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
};

/**
 * 앱(ConfigService)과 마이그레이션 CLI(process.env)가 함께 쓰는 TypeORM(PostgreSQL) 설정.
 * 스키마는 마이그레이션으로만 바꾸므로 모든 환경에서 synchronize를 끈다.
 */
export const buildDataSourceOptions = (
  env: (key: string) => string | undefined,
): DataSourceOptions => ({
  type: 'postgres',
  host: env('DB_HOST'),
  port: Number(env('DB_PORT') ?? 5432),
  username: env('DB_USERNAME'),
  password: env('DB_PASSWORD'),
  database: env('DB_DATABASE'),
  ssl: buildSslOptions(env),
  // DB 세션 시간대를 UTC로 고정한다. (DEFAULT CURRENT_TIMESTAMP·now()가 DB 서버 시간대를 따르지 않게)
  extra: { options: '-c timezone=UTC' },
  synchronize: false,
  entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../migrations/*{.ts,.js}')],
});

export const dataSourceOptions = (config: ConfigService): DataSourceOptions =>
  buildDataSourceOptions((key) => config.get<string>(key));
