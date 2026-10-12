import { ConfigService } from '@nestjs/config';
import { InternalServerError } from '../../../../src/common/response/error/custom.error';
import { MailService } from '../../../../src/common/mail/mail.service';

const sendMail = vi.fn();
const close = vi.fn();
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail, close })),
}));

describe('MailService', () => {
  const service = new MailService(
    new ConfigService({
      EMAIL_USER: 'checktask@gmail.com',
      EMAIL_PASSWORD: 'pw',
    }),
  );

  beforeEach(() => vi.clearAllMocks());

  it('보내는 사람을 Check-Task로 지정해 발송한다', async () => {
    sendMail.mockResolvedValue({});
    await service.send(
      'user@test.com',
      '[Check-Task] 이메일 인증코드',
      '<p>123456</p>',
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Check-Task" <checktask@gmail.com>',
      to: 'user@test.com',
      subject: '[Check-Task] 이메일 인증코드',
      html: '<p>123456</p>',
    });
  });

  it('발송에 실패하면 EMAIL_SEND_FAILED를 던진다', async () => {
    sendMail.mockRejectedValue(new Error('SMTP down'));
    const error = await service
      .send('user@test.com', 's', 'h')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InternalServerError);
    expect((error as InternalServerError).errorCode).toBe('EMAIL_SEND_FAILED');
  });

  it('종료 시 SMTP 연결을 닫는다', () => {
    service.onModuleDestroy();
    expect(close).toHaveBeenCalled();
  });
});
