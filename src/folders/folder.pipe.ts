import { Injectable, PipeTransform } from '@nestjs/common';
import { BadRequestError } from '../common/response/error/custom.error';

/**
 * 쉼표로 구분한 폴더 ID 경로 파라미터('1,2,3')를 숫자 배열로 바꾼다.
 * 레거시와 같이 숫자가 아닌 값은 버리고, 남는 ID가 하나도 없을 때만 400을 던진다.
 */
@Injectable()
export class ParseFolderIdsPipe implements PipeTransform<string, number[]> {
  transform(value: string): number[] {
    const folderIds = value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id))
      .map(Number);

    if (folderIds.length === 0) {
      const message = '유효한 폴더 ID가 제공되지 않았습니다.';
      throw new BadRequestError('VALIDATION_ERROR', message, [
        { field: 'folderId', message },
      ]);
    }
    return folderIds;
  }
}
