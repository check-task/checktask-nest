import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';

// FcmService를 전역 단일 Firebase 앱으로 제공한다.
@Global()
@Module({
  providers: [FcmService],
  exports: [FcmService],
})
export class FcmModule {}
