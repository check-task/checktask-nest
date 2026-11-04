import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { S3Service } from '../common/s3/s3.service';
import { Communication } from './entities/communication.entity';
import { Log } from './entities/log.entity';
import { Reference } from './entities/reference.entity';

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
 * 지금은 다른 도메인(tasks)이 쓰는 기능만 있다. 자료 API는 references 도메인 이관 때 추가한다.
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

  /** S3 key면 Presigned URL을 발급하고, 레거시 URL은 그대로 둔다 */
  private async toFileUrl(stored: string | null): Promise<string | null> {
    if (!stored || LEGACY_FILE_URL.test(stored)) return stored;
    return this.s3Service.getDownloadUrl(stored);
  }
}
