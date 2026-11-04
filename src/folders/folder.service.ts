import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../common/response/error/custom.error';
import {
  CreateFolderDto,
  FolderResponseDto,
  UpdateFolderDto,
  UpdateFolderPriorityDto,
} from './folder.dto';
import { Folder } from './folder.entity';

// 사용자당 최대 폴더 수 (기본 폴더 포함)
const MAX_FOLDER_COUNT = 6;

// 회원가입 시 만들어지는 기본 폴더. 수정·삭제·순서 변경할 수 없다.
export const DEFAULT_FOLDER_TITLE = '지정안함';

@Injectable()
export class FolderService {
  constructor(
    @InjectRepository(Folder)
    private readonly folderRepository: Repository<Folder>,
  ) {}

  /**
   * 폴더 생성 (항상 맨 아래 순서로 추가)
   * @throws BadRequestError(MAX_FOLDER_LIMIT) - 폴더가 이미 최대 개수일 때
   * @throws BadRequestError(DUPLICATE_NAME) - 같은 이름의 폴더가 있을 때
   * @throws BadRequestError(DUPLICATE_COLOR) - 같은 색상의 폴더가 있을 때
   */
  async createFolder(
    userId: number,
    dto: CreateFolderDto,
  ): Promise<FolderResponseDto> {
    const [folderCount, isDuplicateName, isDuplicateColor, maxRank] =
      await Promise.all([
        this.folderRepository.countBy({ userId }),
        this.folderRepository.existsBy({
          userId,
          folderTitle: dto.folderTitle,
        }),
        this.folderRepository.existsBy({ userId, color: dto.color }),
        this.folderRepository.maximum('rank', { userId }),
      ]);

    if (folderCount >= MAX_FOLDER_COUNT) {
      throw new BadRequestError(
        'MAX_FOLDER_LIMIT',
        `폴더는 최대 ${MAX_FOLDER_COUNT}개까지만 생성할 수 있습니다.`,
      );
    }
    if (isDuplicateName) {
      throw new BadRequestError(
        'DUPLICATE_NAME',
        '이미 존재하는 폴더 이름입니다.',
      );
    }
    if (isDuplicateColor) {
      throw new BadRequestError(
        'DUPLICATE_COLOR',
        '이미 사용 중인 색상입니다. 다른 색상을 선택해주세요.',
      );
    }

    // 첫 폴더(기본 폴더)는 rank 0, 이후는 현재 최대 rank + 1
    const folder = await this.folderRepository.save(
      this.folderRepository.create({
        userId,
        folderTitle: dto.folderTitle,
        color: dto.color,
        rank: maxRank === null ? 0 : maxRank + 1,
      }),
    );
    return FolderResponseDto.from(folder);
  }

  /**
   * 폴더 이름·색상 수정
   * @throws NotFoundError(FOLDER_NOT_FOUND) - 폴더가 없을 때
   * @throws ForbiddenError(FORBIDDEN) - 다른 사용자의 폴더일 때
   * @throws BadRequestError(PROTECTED_FOLDER) - 기본 폴더일 때
   * @throws BadRequestError(DUPLICATE_NAME) - 바꿀 이름의 폴더가 이미 있을 때
   * @throws BadRequestError(DUPLICATE_COLOR) - 바꿀 색상의 폴더가 이미 있을 때
   */
  async updateFolder(
    userId: number,
    folderId: number,
    dto: UpdateFolderDto,
  ): Promise<FolderResponseDto> {
    const folder = await this.folderRepository.findOneBy({ id: folderId });
    if (!folder) {
      throw new NotFoundError(
        'FOLDER_NOT_FOUND',
        '해당 폴더를 찾을 수 없습니다.',
      );
    }
    if (folder.userId !== userId) {
      throw new ForbiddenError('FORBIDDEN', '수정 권한이 없습니다.');
    }
    if (folder.folderTitle === DEFAULT_FOLDER_TITLE) {
      throw new BadRequestError(
        'PROTECTED_FOLDER',
        `'${DEFAULT_FOLDER_TITLE}' 폴더는 수정할 수 없습니다.`,
      );
    }

    // 실제로 바뀌는 값만 중복을 확인한다
    const isTitleChanged =
      dto.folderTitle !== undefined && dto.folderTitle !== folder.folderTitle;
    const isColorChanged =
      dto.color !== undefined && dto.color !== folder.color;

    const [isDuplicateName, isDuplicateColor] = await Promise.all([
      isTitleChanged &&
        this.folderRepository.existsBy({
          userId,
          folderTitle: dto.folderTitle,
        }),
      isColorChanged &&
        this.folderRepository.existsBy({ userId, color: dto.color }),
    ]);
    if (isDuplicateName) {
      throw new BadRequestError(
        'DUPLICATE_NAME',
        '이미 존재하는 폴더 이름입니다.',
      );
    }
    if (isDuplicateColor) {
      throw new BadRequestError(
        'DUPLICATE_COLOR',
        '이미 사용 중인 색상입니다.',
      );
    }

    const updatedFolder = await this.folderRepository.save(
      this.folderRepository.merge(folder, {
        ...(dto.folderTitle !== undefined && { folderTitle: dto.folderTitle }),
        ...(dto.color !== undefined && { color: dto.color }),
      }),
    );
    return FolderResponseDto.from(updatedFolder);
  }

  /**
   * 폴더 순서 일괄 변경 (기본 폴더와 다른 사용자의 폴더는 무시한다)
   */
  async updateFolderPriority(
    userId: number,
    dto: UpdateFolderPriorityDto,
  ): Promise<void> {
    if (dto.orderedFolders.length === 0) return;

    // 한 번의 UPDATE로 폴더별 rank를 바꾼다 (반복 UPDATE 방지)
    const cases = dto.orderedFolders
      .map((_, i) => `WHEN :folderId${i} THEN :rank${i}`)
      .join(' ');
    const parameters = Object.fromEntries(
      dto.orderedFolders.flatMap((folder, i) => [
        [`folderId${i}`, folder.folderId],
        [`rank${i}`, folder.rank],
      ]),
    );

    await this.folderRepository
      .createQueryBuilder()
      .update(Folder)
      .set({ rank: () => `CASE "folder_id" ${cases} ELSE "rank" END` })
      .where('"folder_id" IN (:...folderIds)', {
        folderIds: dto.orderedFolders.map((folder) => folder.folderId),
      })
      .andWhere('"user_id" = :userId', { userId })
      .andWhere('"folder_title" != :defaultTitle', {
        defaultTitle: DEFAULT_FOLDER_TITLE,
      })
      .setParameters(parameters)
      .execute();
  }
}
