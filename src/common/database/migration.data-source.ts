import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source';

/**
 * TypeORM 마이그레이션 CLI 전용 DataSource. 빌드된 dist에서 실행한다.
 * @example npm run migration:generate --name=AddTaskTable
 */
// 로컬은 .env를 읽고, 운영처럼 .env가 없으면 이미 주입된 환경 변수를 쓴다
if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(
  buildDataSourceOptions((key) => process.env[key]),
);
