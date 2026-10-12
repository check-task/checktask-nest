import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// 만료·삭제된 디바이스 토큰일 때 FCM이 주는 에러 코드
const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

/**
 * - SENT: 발송 성공
 * - INVALID_TOKEN: 만료·삭제된 토큰 → 호출한 쪽에서 저장된 토큰을 지운다
 * - FAILED: 그 외 실패 (FCM 장애 등)
 */
export type FcmSendResult = 'SENT' | 'INVALID_TOKEN' | 'FAILED';

@Injectable()
export class FcmService implements OnModuleDestroy {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App;
  private readonly messaging: Messaging;

  constructor(config: ConfigService) {
    this.app = initializeApp(
      {
        credential: cert({
          projectId: config.getOrThrow<string>('FIREBASE_PROJECT_ID'),
          clientEmail: config.getOrThrow<string>('FIREBASE_CLIENT_EMAIL'),
          // .env에는 줄바꿈이 '\n' 문자열로 들어가므로 실제 줄바꿈으로 바꾼다
          privateKey: config
            .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
            .replace(/\\n/g, '\n'),
        }),
      },
      'fcm',
    );
    this.messaging = getMessaging(this.app);
  }

  /**
   * 디바이스 토큰 하나로 푸시 알림을 보낸다.
   * 푸시 실패가 요청·cron 잡 전체를 실패시키지 않도록 예외를 던지지 않고 결과만 반환한다.
   * @param data 앱에서 화면 이동 등에 쓸 추가 값 (FCM 규격상 값은 문자열만 가능)
   */
  async send(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<FcmSendResult> {
    try {
      await this.messaging.send({ token, notification: { title, body }, data });
      return 'SENT';
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && INVALID_TOKEN_CODES.includes(code)) return 'INVALID_TOKEN';
      this.logger.error(
        `푸시 발송 실패: ${code ?? 'unknown'}`,
        (error as Error).stack,
      );
      return 'FAILED';
    }
  }

  async onModuleDestroy() {
    await deleteApp(this.app);
  }
}
