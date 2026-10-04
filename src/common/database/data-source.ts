import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

// ConfigService 기반 TypeORM(MySQL) 설정.
export const dataSourceOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: config.get('DB_HOST'),
  port: config.get<number>('DB_PORT'),
  username: config.get('DB_USERNAME'),
  password: config.get('DB_PASSWORD'),
  database: config.get('DB_DATABASE'),
  synchronize: config.get('NODE_ENV') !== 'production', // prod 절대 true 금지
  entities: [join(__dirname, '../../**/*.entity{.ts,.js}')],
});
