import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

describe('S3Service', () => {
  let service: S3Service;

  beforeAll(() => {
    // 서명은 로컬에서 계산되므로 더미 자격 증명으로 검증한다
    process.env.AWS_ACCESS_KEY = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';
    const config = new ConfigService({
      AWS_REGION: 'ap-northeast-2',
      AWS_S3_BUCKET: 'checktask-bucket',
    });
    service = new S3Service(config);
  });

  afterAll(() => {
    delete process.env.AWS_ACCESS_KEY;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it('업로드 URL은 dir/uuid.확장자 키로 발급되고 원본 파일명을 쓰지 않는다', async () => {
    const { key, url } = await service.getUploadUrl(
      'profile',
      '내 사진.PNG',
      'image/png',
    );
    expect(key).toMatch(/^profile\/[0-9a-f-]{36}\.png$/);
    expect(url).toContain(
      `checktask-bucket.s3.ap-northeast-2.amazonaws.com/${key}`,
    );
    expect(url).toContain('X-Amz-Expires=300');
  });

  it('다운로드 URL은 5분 유효한 서명 URL로 발급된다', async () => {
    const url = await service.getDownloadUrl('profile/a.png');
    expect(url).toContain('/profile/a.png?');
    expect(url).toContain('X-Amz-Signature=');
    expect(url).toContain('X-Amz-Expires=300');
  });
});
