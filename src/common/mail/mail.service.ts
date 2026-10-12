import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { InternalServerError } from '../response/error/custom.error';

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.getOrThrow<string>('EMAIL_USER');
    this.transporter = createTransport({
      service: 'gmail',
      auth: { user, pass: config.getOrThrow<string>('EMAIL_PASSWORD') },
    });
    this.from = `"Check-Task" <${user}>`;
  }

  /**
   * HTML 메일을 보낸다.
   * @throws InternalServerError(EMAIL_SEND_FAILED) - SMTP 발송에 실패했을 때
   */
  async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (error) {
      // 외부 SMTP 에러를 정의된 에러 코드로 바꾼다 (상세 원인은 로그로만 남김)
      this.logger.error(`메일 발송 실패: ${to}`, (error as Error).stack);
      throw new InternalServerError(
        'EMAIL_SEND_FAILED',
        '이메일 발송에 실패했습니다.',
      );
    }
  }

  // SMTP 연결 풀을 닫는다
  onModuleDestroy() {
    this.transporter.close();
  }
}
