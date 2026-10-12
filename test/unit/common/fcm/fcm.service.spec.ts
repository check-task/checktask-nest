import { ConfigService } from '@nestjs/config';
import { FcmService } from '../../../../src/common/fcm/fcm.service';

const send = vi.fn();
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn((credential: unknown) => credential),
  deleteApp: vi.fn(),
}));
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({ send })),
}));

describe('FcmService', () => {
  const service = new FcmService(
    new ConfigService({
      FIREBASE_PROJECT_ID: 'checktask',
      FIREBASE_CLIENT_EMAIL: 'fcm@checktask.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: 'key',
    }),
  );

  beforeEach(() => vi.clearAllMocks());

  it('토큰·제목·내용으로 발송하고 SENT를 반환한다', async () => {
    send.mockResolvedValue('message-id');
    await expect(
      service.send('token', '마감 알림', '1시간 남았어요'),
    ).resolves.toBe('SENT');
    expect(send).toHaveBeenCalledWith({
      token: 'token',
      notification: { title: '마감 알림', body: '1시간 남았어요' },
      data: undefined,
    });
  });

  it('만료된 토큰이면 예외 없이 INVALID_TOKEN을 반환한다', async () => {
    send.mockRejectedValue({
      code: 'messaging/registration-token-not-registered',
    });
    await expect(service.send('old', 't', 'b')).resolves.toBe('INVALID_TOKEN');
  });

  it('그 외 실패는 예외 없이 FAILED를 반환한다', async () => {
    send.mockRejectedValue(new Error('network'));
    await expect(service.send('token', 't', 'b')).resolves.toBe('FAILED');
  });
});
