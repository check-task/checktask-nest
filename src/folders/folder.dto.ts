import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Folder } from './folder.entity';

// 사용자가 고를 수 있는 폴더 색상
export const ALLOWED_COLORS = [
  '#818892',
  '#F55757',
  '#FFC93F',
  '#6EC77B',
  '#A177E2',
  '#081221',
  '#B5BAC4',
];

// 앞뒤 공백 제거 (문자열이 아니면 그대로 두고 검증에서 걸러낸다)
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// 색상은 대문자 HEX로 저장한다
const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ===== 요청 =====

export class CreateFolderDto {
  @ApiProperty({ example: '전공', maxLength: 10 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '폴더 이름은 필수입니다.' })
  @MaxLength(10, { message: '폴더 이름은 최대 10자까지만 가능합니다.' })
  folderTitle: string;

  @ApiProperty({ enum: ALLOWED_COLORS, example: '#F55757' })
  @Transform(trimUpper)
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/, {
    message: '색상은 #을 포함한 7자리 Hex 코드여야 합니다.',
  })
  @IsIn(ALLOWED_COLORS, { message: '허용되지 않는 색상입니다.' })
  color: string;
}

/**
 * 폴더 수정
 * folderTitle·color 중 보낸 값만 수정한다. (둘 다 없으면 400)
 */
export class UpdateFolderDto {
  @ApiPropertyOptional({ example: '전공', maxLength: 10 })
  @ValidateIf(
    (dto: UpdateFolderDto) =>
      dto.folderTitle !== undefined || dto.color === undefined,
  )
  @IsDefined({ message: 'folderTitle 또는 color 중 하나는 필수입니다.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: '폴더 이름은 필수입니다.' })
  @MaxLength(10, { message: '폴더 이름은 최대 10자까지만 가능합니다.' })
  folderTitle?: string;

  @ApiPropertyOptional({ enum: ALLOWED_COLORS, example: '#F55757' })
  @IsOptional()
  @Transform(trimUpper)
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/, {
    message: '색상은 #을 포함한 7자리 Hex 코드여야 합니다.',
  })
  @IsIn(ALLOWED_COLORS, { message: '허용되지 않는 색상입니다.' })
  color?: string;
}

export class FolderRankDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  folderId: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  rank: number;
}

export class UpdateFolderPriorityDto {
  @ApiProperty({ type: [FolderRankDto] })
  @IsArray({ message: '순서 변경 데이터가 올바르지 않습니다.' })
  @ValidateNested({ each: true })
  @Type(() => FolderRankDto)
  orderedFolders: FolderRankDto[];
}

// ===== 응답관련 DTO =====

// 폴더 생성·수정
export class FolderResponseDto {
  @ApiProperty() folderId: number;
  @ApiProperty() userId: number;
  @ApiProperty() folderTitle: string;
  @ApiProperty({ example: '#F55757' }) color: string;

  static from(folder: Folder): FolderResponseDto {
    const dto = new FolderResponseDto();
    dto.folderId = folder.id;
    dto.userId = folder.userId;
    dto.folderTitle = folder.folderTitle;
    dto.color = folder.color;
    return dto;
  }
}
