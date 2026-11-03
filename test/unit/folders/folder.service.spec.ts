import { Repository } from 'typeorm';
import { CustomError } from '../../../src/common/response/error/custom.error';
import { Folder } from '../../../src/folders/folder.entity';
import { FolderService } from '../../../src/folders/folder.service';

describe('FolderService', () => {
  const findOne = vi.fn();
  const service = new FolderService({
    findOne,
  } as unknown as Repository<Folder>);
  const errorCodeOf = (promise: Promise<unknown>) =>
    promise.then(
      () => 'NO_ERROR',
      (error: unknown) => (error as CustomError).errorCode,
    );

  beforeEach(() => vi.clearAllMocks());

  it('folderId가 없으면 "지정안함" 폴더를 쓴다', async () => {
    findOne.mockResolvedValue({ id: 7 });
    expect(await service.resolveFolderId(1, null)).toBe(7);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, folderTitle: '지정안함' },
      }),
    );
  });

  it('기본 폴더가 없으면 DEFAULT_FOLDER_NOT_FOUND', async () => {
    findOne.mockResolvedValue(null);
    expect(await errorCodeOf(service.resolveFolderId(1, undefined))).toBe(
      'DEFAULT_FOLDER_NOT_FOUND',
    );
  });

  it('폴더가 없으면 FOLDER_NOT_FOUND, 다른 사용자 폴더면 FORBIDDEN_FOLDER', async () => {
    findOne.mockResolvedValueOnce(null);
    expect(await errorCodeOf(service.resolveFolderId(1, 3))).toBe(
      'FOLDER_NOT_FOUND',
    );
    findOne.mockResolvedValueOnce({ id: 3, userId: 2 });
    expect(await errorCodeOf(service.resolveFolderId(1, 3))).toBe(
      'FORBIDDEN_FOLDER',
    );
  });
});
