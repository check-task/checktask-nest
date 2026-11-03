import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ForbiddenError,
  NotFoundError,
} from '../common/response/error/custom.error';
import { DEFAULT_FOLDER_TITLE, Folder } from './folder.entity';

/**
 * folders 도메인 Service.
 * 지금은 다른 도메인(tasks)이 쓰는 기능만 있다. 폴더 API는 folders 도메인 이관 때 추가한다.
 */
@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  /**
   * folderId가 없으면 "지정안함" 폴더, 있으면 본인 폴더인지 확인해 ID를 반환한다.
   * @throws NotFoundError(DEFAULT_FOLDER_NOT_FOUND) - 기본 폴더가 없을 때
   * @throws NotFoundError(FOLDER_NOT_FOUND) - 폴더가 없을 때
   * @throws ForbiddenError(FORBIDDEN_FOLDER) - 다른 사용자의 폴더일 때
   */
  async resolveFolderId(
    userId: number,
    folderId: number | null | undefined,
  ): Promise<number> {
    if (folderId === null || folderId === undefined) {
      const defaultFolder = await this.folderRepository.findOne({
        where: { userId, folderTitle: DEFAULT_FOLDER_TITLE },
        select: { id: true },
      });
      if (!defaultFolder) {
        throw new NotFoundError(
          'DEFAULT_FOLDER_NOT_FOUND',
          '기본 폴더가 존재하지 않습니다.',
        );
      }
      return defaultFolder.id;
    }

    const folder = await this.folderRepository.findOne({
      where: { id: folderId },
      select: { id: true, userId: true },
    });
    if (!folder) {
      throw new NotFoundError('FOLDER_NOT_FOUND', '폴더가 존재하지 않습니다.');
    }
    if (folder.userId !== userId) {
      throw new ForbiddenError('FORBIDDEN_FOLDER', '본인 폴더가 아닙니다.');
    }
    return folder.id;
  }
}
