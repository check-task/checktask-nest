import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthModule } from './../src/health/health.module';
import { ResponseInterceptor } from '../src/common/response/success/response.interceptor';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        resultType: 'SUCCESS',
        message: '서버 정상 동작 중',
        data: { status: 'ok' },
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
