import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Communication } from './entities/communication.entity';
import { Log } from './entities/log.entity';
import { Reference } from './entities/reference.entity';

// 자료 파일 S3 저장 경로
export const REFERENCE_FILE_DIR = 'reference';

// 업로드 URL 발급 API가 돌려준 key 형식 
const REFERENCE_FILE_KEY = /^reference\/[0-9a-f-]{36}(\.[a-z0-9]+)?$/;

// 회의 날짜 형식 (DATE 컬럼)
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// 앞뒤 공백 제거 (문자열이 아니면 그대로 두고 검증에서 걸러낸다)
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// ===== 요청: 자료 =====

export const REFERENCE_TYPES = ['url', 'file'] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

export class CreateReferenceQueryDto {
  @ApiProperty({
    enum: REFERENCE_TYPES,
    description: '링크(url) 또는 파일(file)',
  })
  @IsIn(REFERENCE_TYPES, { message: 'type은 url 또는 file이어야 합니다.' })
  type: ReferenceType;
}

// 자료 파일 업로드 URL 발급
export class GetReferenceUploadUrlDto {
  @ApiProperty({ example: '회의자료.pdf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, {
    message: 'contentType 형식이 올바르지 않습니다.',
  })
  @MaxLength(100)
  contentType: string;
}

/**
 * 자료 생성
 * - type=url: name, url 필수
 * - type=file: 업로드 URL 발급 때 받은 file_key 필수 (name을 생략하면 file_name으로 저장)
 */
export class CreateReferenceDto {
  @ApiPropertyOptional({ example: '참고 링크', maxLength: 50 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'https://checktask.kr', maxLength: 255 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  url?: string;

  @ApiPropertyOptional({
    description: '파일 자료: 업로드 URL 발급 시 받은 key',
    example: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
  })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_FILE_KEY, { message: '올바른 자료 파일 key가 아닙니다.' })
  file_key?: string;

  @ApiPropertyOptional({
    description: '파일 자료: 원본 파일명',
    example: '회의자료.pdf',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  file_name?: string;
}

/**
 * 자료 수정 (name·url·file_key 중 하나는 필수)
 * url을 보내면 파일 정보가 지워지고, file_key를 보내면 링크가 지워진다.
 */
export class UpdateReferenceDto {
  @ApiPropertyOptional({ example: '참고 링크', maxLength: 50 })
  @ValidateIf(
    (dto: UpdateReferenceDto) =>
      dto.name !== undefined ||
      (dto.url === undefined && dto.file_key === undefined),
  )
  @IsDefined({ message: '수정할 값이 없습니다.' })
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'https://checktask.kr', maxLength: 255 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  url?: string;

  @ApiPropertyOptional({
    description: '업로드 URL 발급 시 받은 key',
    example: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
  })
  @IsOptional()
  @IsString()
  @Matches(REFERENCE_FILE_KEY, { message: '올바른 자료 파일 key가 아닙니다.' })
  file_key?: string;

  @ApiPropertyOptional({ example: '회의자료.pdf' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  file_name?: string;
}

// ===== 요청: 커뮤니케이션 =====

export class CreateCommunicationDto {
  @ApiProperty({ example: '카카오톡 오픈채팅', maxLength: 50 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'name은 필수입니다.' })
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'https://open.kakao.com/o/abc', maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'url은 필수입니다.' })
  @MaxLength(255)
  url: string;
}

// 커뮤니케이션 수정 (name·url 중 하나는 필수)
export class UpdateCommunicationDto {
  @ApiPropertyOptional({ example: '카카오톡 오픈채팅', maxLength: 50 })
  @ValidateIf(
    (dto: UpdateCommunicationDto) =>
      dto.name !== undefined || dto.url === undefined,
  )
  @IsDefined({ message: '수정할 값이 없습니다.' })
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    example: 'https://open.kakao.com/o/abc',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  url?: string;
}

// ===== 요청: 회의록 =====

export class CreateLogDto {
  @ApiProperty({ description: '회의 날짜', example: '2026-10-20' })
  @IsString({ message: '회의 일자(date)는 필수입니다.' })
  @Matches(DATE_ONLY, {
    message: '회의 일자(date)는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  agenda?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  conclusion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  discussion?: string | null;
}

// 회의록 수정 (date·agenda·conclusion·discussion 중 하나는 필수)
export class UpdateLogDto {
  @ApiPropertyOptional({ description: '회의 날짜', example: '2026-10-20' })
  @ValidateIf(
    (dto: UpdateLogDto) =>
      dto.date !== undefined ||
      (dto.agenda === undefined &&
        dto.conclusion === undefined &&
        dto.discussion === undefined),
  )
  @IsDefined({ message: '수정할 값이 없습니다.' })
  @IsString()
  @Matches(DATE_ONLY, {
    message: '회의 일자(date)는 YYYY-MM-DD 형식이어야 합니다.',
  })
  date?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  agenda?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  conclusion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  discussion?: string | null;
}

// ===== 응답 =====

// 업로드 URL 발급
export class ReferenceUploadUrlResponseDto {
  @ApiProperty({
    description: '자료 생성·수정 시 file_key로 보낼 값',
    example: 'reference/3f2b8c1e-6a4d-4e0f-9b7a-1c2d3e4f5a6b.pdf',
  })
  key: string;

  @ApiProperty({
    description:
      '이 URL로 PUT 업로드 (요청 때와 같은 Content-Type 헤더 필수, 5분 유효)',
  })
  url: string;

  static from(upload: {
    key: string;
    url: string;
  }): ReferenceUploadUrlResponseDto {
    const dto = new ReferenceUploadUrlResponseDto();
    dto.key = upload.key;
    dto.url = upload.url;
    return dto;
  }
}

// 자료 생성 (레거시와 같이 저장한 값을 돌려준다, id 없음)
export class CreatedReferenceResponseDto {
  @ApiProperty() taskId: number;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) fileName: string | null;
  @ApiProperty({ type: String, nullable: true }) url: string | null;
  @ApiProperty({ type: String, nullable: true, description: '파일 조회 URL' })
  fileUrl: string | null;

  /**
   * @param fileUrl 저장된 파일 key로 발급한 조회 URL
   */
  static from(
    reference: Reference,
    fileUrl: string | null,
  ): CreatedReferenceResponseDto {
    const dto = new CreatedReferenceResponseDto();
    dto.taskId = reference.taskId;
    dto.name = reference.name;
    dto.fileName = reference.fileName;
    dto.url = reference.url;
    dto.fileUrl = fileUrl;
    return dto;
  }
}

// 자료 수정
export class ReferenceResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty({ type: String, nullable: true }) fileName: string | null;
  @ApiProperty({ type: String, nullable: true }) url: string | null;
  @ApiProperty({ type: String, nullable: true, description: '파일 조회 URL' })
  fileUrl: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;

  /**
   * @param fileUrl 저장된 파일 key로 발급한 조회 URL
   */
  static from(
    reference: Reference,
    fileUrl: string | null,
  ): ReferenceResponseDto {
    const dto = new ReferenceResponseDto();
    dto.id = reference.id;
    dto.name = reference.name;
    dto.fileName = reference.fileName;
    dto.url = reference.url;
    dto.fileUrl = fileUrl;
    dto.updatedAt = reference.updatedAt;
    return dto;
  }
}

// 커뮤니케이션 생성·수정
export class CommunicationResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() url: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt: Date | null;

  static from(communication: Communication): CommunicationResponseDto {
    const dto = new CommunicationResponseDto();
    dto.id = communication.id;
    dto.name = communication.name;
    dto.url = communication.url;
    dto.updatedAt = communication.updatedAt;
    return dto;
  }
}

// 회의록 생성·수정
export class LogResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ example: '2026-10-20' }) date: string;
  @ApiProperty({ type: String, nullable: true }) agenda: string | null;
  @ApiProperty({ type: String, nullable: true }) conclusion: string | null;
  @ApiProperty({ type: String, nullable: true }) discussion: string | null;

  static from(log: Log): LogResponseDto {
    const dto = new LogResponseDto();
    dto.id = log.id;
    dto.date = log.date;
    dto.agenda = log.agenda;
    dto.conclusion = log.conclusion;
    dto.discussion = log.discussion;
    return dto;
  }
}

// 삭제
export class DeletedIdResponseDto {
  @ApiProperty() id: number;

  static from(id: number): DeletedIdResponseDto {
    const dto = new DeletedIdResponseDto();
    dto.id = id;
    return dto;
  }
}
