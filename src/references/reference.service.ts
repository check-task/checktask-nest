import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../common/response/error/custom.error';
import { S3Service } from '../common/s3/s3.service';
import { Member } from '../tasks/entities/member.entity';
import { Task } from '../tasks/entities/task.entity';
import { Communication } from './entities/communication.entity';
import { Log } from './entities/log.entity';
import { Reference } from './entities/reference.entity';
import {
  CommunicationResponseDto,
  CreateCommunicationDto,
  CreatedReferenceResponseDto,
  CreateLogDto,
  CreateReferenceDto,
  DeletedIdResponseDto,
  GetReferenceUploadUrlDto,
  LogResponseDto,
  REFERENCE_FILE_DIR,
  ReferenceResponseDto,
  ReferenceType,
  ReferenceUploadUrlResponseDto,
  UpdateCommunicationDto,
  UpdateLogDto,
  UpdateReferenceDto,
} from './reference.dto';

// 레거시는 파일의 S3 URL 전체를 저장했고, 새 규칙(COMMON s3)은 key를 저장한다
const LEGACY_FILE_URL = /^https?:\/\//;

export interface ReferenceLinkInput {
  name: string;
  url?: string;
}

export interface CommunicationInput {
  name: string;
  url: string;
}

export interface TaskReferences {
  references: Reference[];
  logs: Log[];
  communications: Communication[];
}

/**
 * references 도메인 Service (자료·회의록·커뮤니케이션).
 * createForTask·findAllByTaskId는 과제(tasks) 도메인(과제 생성·상세 조회)에서도 사용한다.
 */
@Injectable()
export class ReferenceService {
  constructor(
    @InjectRepository(Reference)
    private readonly referenceRepository: Repository<Reference>,
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    @InjectRepository(Communication)
    private readonly communicationRepository: Repository<Communication>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly s3Service: S3Service,
  ) {}

  /** 과제 생성 시 함께 받은 링크 자료·커뮤니케이션 저장 (과제 생성 트랜잭션 안에서 호출) */
  async createForTask(
    manager: EntityManager,
    taskId: number,
    references: ReferenceLinkInput[],
    communications: CommunicationInput[],
  ): Promise<void> {
    if (references.length > 0) {
      await manager.insert(
        Reference,
        references.map((reference) => ({
          taskId,
          name: reference.name,
          url: reference.url ?? null,
        })),
      );
    }
    if (communications.length > 0) {
      await manager.insert(
        Communication,
        communications.map((communication) => ({
          taskId,
          name: communication.name,
          url: communication.url,
        })),
      );
    }
  }

  /** 과제의 자료·회의록·커뮤니케이션 조회. 파일 자료는 조회용 URL로 바꿔 반환한다 */
  async findAllByTaskId(taskId: number): Promise<TaskReferences> {
    const [references, logs, communications] = await Promise.all([
      this.referenceRepository.find({
        where: { taskId },
        order: { id: 'ASC' },
      }),
      this.logRepository.find({ where: { taskId }, order: { id: 'ASC' } }),
      this.communicationRepository.find({
        where: { taskId },
        order: { id: 'ASC' },
      }),
    ]);
    await Promise.all(
      references.map(async (reference) => {
        reference.fileUrl = await this.toFileUrl(reference.fileUrl);
      }),
    );
    return { references, logs, communications };
  }

  // ===== 자료 =====

  /**
   * 자료 파일 업로드용 Presigned URL 발급
   * 클라이언트는 url로 S3에 직접 업로드한 뒤, key를 자료 생성·수정 API의 file_key로 보낸다.
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   */
  async getReferenceUploadUrl(
    taskId: number,
    userId: number,
    dto: GetReferenceUploadUrlDto,
  ): Promise<ReferenceUploadUrlResponseDto> {
    await this.assertTaskMember(taskId, userId);
    const upload = await this.s3Service.getUploadUrl(
      REFERENCE_FILE_DIR,
      dto.fileName,
      dto.contentType,
    );
    return ReferenceUploadUrlResponseDto.from(upload);
  }

  /**
   * 자료 생성
   * @throws BadRequestError(BAD_REQUEST) - type에 필요한 값(url·file_key·name)이 없을 때
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   */
  async createReferences(
    taskId: number,
    userId: number,
    type: ReferenceType,
    dto: CreateReferenceDto,
  ): Promise<CreatedReferenceResponseDto[]> {
    // type에 맞는 값이 있는지 먼저 확인
    if (type === 'file' && !dto.file_key) {
      throw new BadRequestError('BAD_REQUEST', '업로드된 파일이 없습니다.');
    }
    if (type === 'url' && !dto.url) {
      throw new BadRequestError('BAD_REQUEST', 'url은 필수입니다.');
    }
    // 파일 이름을 생략하면 원본 파일명으로 저장
    const name = type === 'file' ? (dto.name ?? dto.file_name) : dto.name;
    if (!name) {
      throw new BadRequestError('BAD_REQUEST', 'name은 필수입니다.');
    }

    await this.assertTaskMember(taskId, userId);

    const reference = await this.referenceRepository.save(
      this.referenceRepository.create({
        taskId,
        name,
        fileName: type === 'file' ? (dto.file_name ?? null) : null,
        url: type === 'url' ? (dto.url ?? null) : null,
        fileUrl: type === 'file' ? (dto.file_key ?? null) : null,
      }),
    );
    const fileUrl = await this.toFileUrl(reference.fileUrl);
    return [CreatedReferenceResponseDto.from(reference, fileUrl)];
  }

  /**
   * 자료 수정. url을 보내면 파일 정보를, file_key를 보내면 링크를 지운다.
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(REFERENCE_NOT_FOUND) - 이 과제의 자료가 없을 때
   */
  async updateReference(
    taskId: number,
    referenceId: number,
    userId: number,
    dto: UpdateReferenceDto,
  ): Promise<ReferenceResponseDto> {
    await this.assertTaskMember(taskId, userId);
    await this.getReference(taskId, referenceId);

    // 빈 값은 무시하고, url·file_key를 함께 보내면 파일이 남는다
    await this.referenceRepository.update(
      { id: referenceId },
      {
        ...(dto.name && { name: dto.name }),
        ...(dto.url && { url: dto.url, fileUrl: null, fileName: null }),
        ...(dto.file_key && {
          fileUrl: dto.file_key,
          url: null,
          fileName: dto.file_name ?? null,
        }),
      },
    );

    const updated = await this.getReference(taskId, referenceId);
    const fileUrl = await this.toFileUrl(updated.fileUrl);
    return ReferenceResponseDto.from(updated, fileUrl);
  }

  /**
   * 자료 삭제
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(REFERENCE_NOT_FOUND) - 이 과제의 자료가 없을 때
   */
  async deleteReference(
    taskId: number,
    referenceId: number,
    userId: number,
  ): Promise<DeletedIdResponseDto> {
    await this.assertTaskMember(taskId, userId);
    await this.getReference(taskId, referenceId);

    await this.referenceRepository.delete({ id: referenceId });
    return DeletedIdResponseDto.from(referenceId);
  }

  // ===== 커뮤니케이션 =====

  /**
   * 커뮤니케이션 생성
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   */
  async createCommunication(
    taskId: number,
    userId: number,
    dto: CreateCommunicationDto,
  ): Promise<CommunicationResponseDto> {
    await this.assertTaskMember(taskId, userId);

    const { id } = await this.communicationRepository.save(
      this.communicationRepository.create({
        taskId,
        name: dto.name,
        url: dto.url,
      }),
    );
    const communication = await this.getCommunication(taskId, id);
    return CommunicationResponseDto.from(communication);
  }

  /**
   * 커뮤니케이션 수정 (과제 존재 확인 없이 참여자만 확인)
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(COMMUNICATION_NOT_FOUND) - 이 과제의 커뮤니케이션이 없을 때
   */
  async updateCommunication(
    taskId: number,
    communicationId: number,
    userId: number,
    dto: UpdateCommunicationDto,
  ): Promise<CommunicationResponseDto> {
    await this.assertMember(taskId, userId);
    await this.getCommunication(taskId, communicationId);

    // 빈 값은 무시한다
    await this.communicationRepository.update(
      { id: communicationId },
      { ...(dto.name && { name: dto.name }), ...(dto.url && { url: dto.url }) },
    );

    const updated = await this.getCommunication(taskId, communicationId);
    return CommunicationResponseDto.from(updated);
  }

  /**
   * 커뮤니케이션 삭제 (과제 존재 확인 없이 참여자만 확인)
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(COMMUNICATION_NOT_FOUND) - 이 과제의 커뮤니케이션이 없을 때
   */
  async deleteCommunication(
    taskId: number,
    communicationId: number,
    userId: number,
  ): Promise<DeletedIdResponseDto> {
    await this.assertMember(taskId, userId);
    await this.getCommunication(taskId, communicationId);

    await this.communicationRepository.delete({ id: communicationId });
    return DeletedIdResponseDto.from(communicationId);
  }

  // ===== 회의록 =====

  /**
   * 회의록 생성
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   */
  async createLog(
    taskId: number,
    userId: number,
    dto: CreateLogDto,
  ): Promise<LogResponseDto> {
    await this.assertTaskMember(taskId, userId);

    // 빈 값은 null로 저장한다
    const { id } = await this.logRepository.save(
      this.logRepository.create({
        taskId,
        date: dto.date,
        agenda: dto.agenda || null,
        conclusion: dto.conclusion || null,
        discussion: dto.discussion || null,
      }),
    );
    const log = await this.getLog(taskId, id);
    return LogResponseDto.from(log);
  }

  /**
   * 회의록 수정
   * @throws NotFoundError(TASK_NOT_FOUND) - 과제가 없을 때
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(LOG_NOT_FOUND) - 이 과제의 회의록이 없을 때
   */
  async updateLog(
    taskId: number,
    logId: number,
    userId: number,
    dto: UpdateLogDto,
  ): Promise<LogResponseDto> {
    await this.assertTaskMember(taskId, userId);
    await this.getLog(taskId, logId);

    // 빈 값은 무시한다
    await this.logRepository.update(
      { id: logId },
      {
        ...(dto.date && { date: dto.date }),
        ...(dto.agenda && { agenda: dto.agenda }),
        ...(dto.conclusion && { conclusion: dto.conclusion }),
        ...(dto.discussion && { discussion: dto.discussion }),
      },
    );

    const updated = await this.getLog(taskId, logId);
    return LogResponseDto.from(updated);
  }

  /**
   * 회의록 삭제 (제 존재 확인 없이 참여자만 확인한다)
   * @throws UnauthorizedError(UNAUTHORIZED) - 과제 참여자가 아닐 때
   * @throws NotFoundError(LOG_NOT_FOUND) - 이 과제의 회의록이 없을 때
   */
  async deleteLog(
    taskId: number,
    logId: number,
    userId: number,
  ): Promise<DeletedIdResponseDto> {
    await this.assertMember(taskId, userId);
    await this.getLog(taskId, logId);

    await this.logRepository.delete({ id: logId });
    return DeletedIdResponseDto.from(logId);
  }

  // ===== 내부 =====

  // 과제가 있고 요청한 사용자가 그 과제의 참여자인지 확인한다
  private async assertTaskMember(
    taskId: number,
    userId: number,
  ): Promise<void> {
    const [taskExists, isMember] = await Promise.all([
      this.taskRepository.existsBy({ id: taskId }),
      this.memberRepository.existsBy({ taskId, userId }),
    ]);
    if (!taskExists) {
      throw new NotFoundError('TASK_NOT_FOUND', 'taskId가 존재하지 않습니다.');
    }
    if (!isMember) {
      throw new UnauthorizedError('UNAUTHORIZED', '권한이 없습니다.');
    }
  }

  private async assertMember(taskId: number, userId: number): Promise<void> {
    const isMember = await this.memberRepository.existsBy({ taskId, userId });
    if (!isMember) {
      throw new UnauthorizedError('UNAUTHORIZED', '권한이 없습니다.');
    }
  }

  // 다른 과제의 자료를 고치지 못하게 taskId까지 함께 조회한다
  private async getReference(
    taskId: number,
    referenceId: number,
  ): Promise<Reference> {
    const reference = await this.referenceRepository.findOneBy({
      id: referenceId,
      taskId,
    });
    if (!reference) {
      throw new NotFoundError(
        'REFERENCE_NOT_FOUND',
        '자료가 존재하지 않습니다.',
      );
    }
    return reference;
  }

  private async getCommunication(
    taskId: number,
    communicationId: number,
  ): Promise<Communication> {
    const communication = await this.communicationRepository.findOneBy({
      id: communicationId,
      taskId,
    });
    if (!communication) {
      throw new NotFoundError(
        'COMMUNICATION_NOT_FOUND',
        '커뮤니케이션이 존재하지 않습니다.',
      );
    }
    return communication;
  }

  private async getLog(taskId: number, logId: number): Promise<Log> {
    const log = await this.logRepository.findOneBy({ id: logId, taskId });
    if (!log) {
      throw new NotFoundError('LOG_NOT_FOUND', '회의록이 존재하지 않습니다.');
    }
    return log;
  }

  /** S3 key면 Presigned URL을 발급하고, 레거시 URL은 그대로 둔다 */
  private async toFileUrl(stored: string | null): Promise<string | null> {
    if (!stored || LEGACY_FILE_URL.test(stored)) return stored;
    return this.s3Service.getDownloadUrl(stored);
  }
}
