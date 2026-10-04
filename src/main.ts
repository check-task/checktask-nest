import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './common/auth/guards/jwt-auth.guard';
import { ResponseInterceptor } from './common/response/success/response.interceptor';
import { GlobalExceptionFilter } from './common/response/error/error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({ origin: config.get('ALLOWED_ORIGIN'), credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  // whitelist: DTO 미정의 필드 자동 제거
  // transform: 요청 값을 DTO 인스턴스로 변환 (@Type 형변환·필드 기본값 적용)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector))); // 전역 인증
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // 운영 환경에서는 Swagger 문서(UI·JSON·YAML)에 ID/비밀번호를 요구한다
  if (config.get('NODE_ENV') === 'production') {
    const swaggerUser = config.get<string>('SWAGGER_USER');
    const swaggerPassword = config.get<string>('SWAGGER_PASSWORD');
    // 빈 값이면 빈 ID/비밀번호로 통과되므로 서버를 띄우지 않는다
    if (!swaggerUser || !swaggerPassword) {
      throw new Error(
        '운영 환경에는 SWAGGER_USER, SWAGGER_PASSWORD가 필요합니다.',
      );
    }
    app.use(
      ['/docs', '/docs-json', '/docs-yaml'],
      basicAuth({
        users: { [swaggerUser]: swaggerPassword },
        challenge: true, // 브라우저 로그인 창 표시
      }),
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(config.get('PORT') ?? 8000);
}
void bootstrap();
