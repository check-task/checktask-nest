import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

// MailService를 전역 단일 SMTP 클라이언트로 제공한다.
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
