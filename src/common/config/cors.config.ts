import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

// 레거시(checktask-back)와 같은 허용 출처. 도메인이 추가되면 여기에 함께 추가한다.
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8000',
  'https://www.checktask.kr',
  'https://checktask.kr',
  'https://api.checktask.kr',
  'https://dev.checktask.kr',
];

export const CORS_OPTIONS: CorsOptions = {
  origin: ALLOWED_ORIGINS,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
