import { Repository } from 'typeorm';
import { S3Service } from '../../../src/common/s3/s3.service';
import { Communication } from '../../../src/references/entities/communication.entity';
import { Log } from '../../../src/references/entities/log.entity';
import { Reference } from '../../../src/references/entities/reference.entity';
import { ReferenceService } from '../../../src/references/reference.service';
import { Member } from '../../../src/tasks/entities/member.entity';
import { Task } from '../../../src/tasks/entities/task.entity';

const repo = <T extends object>(methods: Record<string, unknown> = {}) =>
  methods as unknown as Repository<T>;

const createService = ({
  reference = {},
  log = {},
  communication = {},
  taskExists = true,
  isMember = true,
  s3 = {},
}: {
  reference?: Record<string, unknown>;
  log?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  taskExists?: boolean;
  isMember?: boolean;
  s3?: Record<string, unknown>;
} = {}) =>
  new ReferenceService(
    repo<Reference>(reference),
    repo<Log>(log),
    repo<Communication>(communication),
    repo<Task>({ existsBy: vi.fn().mockResolvedValue(taskExists) }),
    repo<Member>({ existsBy: vi.fn().mockResolvedValue(isMember) }),
    s3 as unknown as S3Service,
  );

describe('ReferenceService', () => {
  it('파일 자료는 S3 key면 조회용 URL을 발급하고, 레거시 URL은 그대로 둔다', async () => {
    const references = [
      { id: 1, fileUrl: 'reference/abc.pdf' },
      { id: 2, fileUrl: 'https://checktask.s3.amazonaws.com/old.pdf' },
      { id: 3, fileUrl: null },
    ];
    const getDownloadUrl = vi.fn(async (key: string) => `signed:${key}`);
    const service = createService({
      reference: { find: vi.fn().mockResolvedValue(references) },
      log: { find: vi.fn().mockResolvedValue([]) },
      communication: { find: vi.fn().mockResolvedValue([]) },
      s3: { getDownloadUrl },
    });

    const result = await service.findAllByTaskId(10);

    expect(result.references.map((reference) => reference.fileUrl)).toEqual([
      'signed:reference/abc.pdf',
      'https://checktask.s3.amazonaws.com/old.pdf',
      null,
    ]);
    expect(getDownloadUrl).toHaveBeenCalledTimes(1);
  });

  describe('권한 확인', () => {
    it('과제가 없으면 참여자 여부와 상관없이 TASK_NOT_FOUND를 던진다', async () => {
      const service = createService({ taskExists: false, isMember: false });

      await expect(
        service.createCommunication(10, 1, { name: '채팅', url: 'https://a' }),
      ).rejects.toMatchObject({ statusCode: 404, errorCode: 'TASK_NOT_FOUND' });
    });

    it('과제 참여자가 아니면 레거시와 같이 401 UNAUTHORIZED를 던진다', async () => {
      const service = createService({ isMember: false });

      await expect(
        service.createLog(10, 1, { date: '2026-10-20' }),
      ).rejects.toMatchObject({ statusCode: 401, errorCode: 'UNAUTHORIZED' });
    });

    it('다른 과제의 자료는 REFERENCE_NOT_FOUND로 막는다', async () => {
      const findOneBy = vi.fn().mockResolvedValue(null);
      const service = createService({ reference: { findOneBy } });

      await expect(service.deleteReference(10, 99, 1)).rejects.toMatchObject({
        statusCode: 404,
        errorCode: 'REFERENCE_NOT_FOUND',
      });
      expect(findOneBy).toHaveBeenCalledWith({ id: 99, taskId: 10 });
    });
  });

  describe('createReferences', () => {
    it('type=file인데 file_key가 없으면 400을 던진다', async () => {
      const service = createService();

      await expect(
        service.createReferences(10, 1, 'file', { name: '자료' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('파일 자료는 name을 생략하면 원본 파일명으로 저장한다', async () => {
      const save = vi.fn(async (reference: Reference) => reference);
      const service = createService({
        reference: { create: (value: Reference) => value, save },
        s3: { getDownloadUrl: vi.fn(async () => 'signed') },
      });

      const [created] = await service.createReferences(10, 1, 'file', {
        file_key: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
        file_name: '회의자료.pdf',
      });

      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '회의자료.pdf',
          fileName: '회의자료.pdf',
          url: null,
        }),
      );
      expect(created.fileUrl).toBe('signed');
    });
  });

  describe('updateReference', () => {
    it('url로 바꾸면 파일 정보를 지우고, file_key로 바꾸면 링크를 지운다', async () => {
      const update = vi.fn();
      const reference = { id: 5, taskId: 10, fileUrl: null } as Reference;
      const service = createService({
        reference: { findOneBy: vi.fn().mockResolvedValue(reference), update },
      });

      await service.updateReference(10, 5, 1, { url: 'https://new' });
      await service.updateReference(10, 5, 1, {
        file_key: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
        file_name: 'a.pdf',
      });

      expect(update).toHaveBeenNthCalledWith(
        1,
        { id: 5 },
        { url: 'https://new', fileUrl: null, fileName: null },
      );
      expect(update).toHaveBeenNthCalledWith(
        2,
        { id: 5 },
        {
          fileUrl: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
          url: null,
          fileName: 'a.pdf',
        },
      );
    });
  });
});
