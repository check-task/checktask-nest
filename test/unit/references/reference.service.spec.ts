import { Repository } from 'typeorm';
import { S3Service } from '../../../src/common/s3/s3.service';
import { Communication } from '../../../src/references/entities/communication.entity';
import { Log } from '../../../src/references/entities/log.entity';
import { Reference } from '../../../src/references/entities/reference.entity';
import { ReferenceService } from '../../../src/references/reference.service';

describe('ReferenceService', () => {
  it('파일 자료는 S3 key면 조회용 URL을 발급하고, 레거시 URL은 그대로 둔다', async () => {
    const references = [
      { id: 1, fileUrl: 'reference/abc.pdf' },
      { id: 2, fileUrl: 'https://checktask.s3.amazonaws.com/old.pdf' },
      { id: 3, fileUrl: null },
    ];
    const repo = <T extends object>(rows: unknown[]) =>
      ({ find: vi.fn().mockResolvedValue(rows) }) as unknown as Repository<T>;
    const getDownloadUrl = vi.fn(async (key: string) => `signed:${key}`);
    const service = new ReferenceService(
      repo<Reference>(references),
      repo<Log>([]),
      repo<Communication>([]),
      { getDownloadUrl } as unknown as S3Service,
    );

    const result = await service.findAllByTaskId(10);

    expect(result.references.map((reference) => reference.fileUrl)).toEqual([
      'signed:reference/abc.pdf',
      'https://checktask.s3.amazonaws.com/old.pdf',
      null,
    ]);
    expect(getDownloadUrl).toHaveBeenCalledTimes(1);
  });
});
