import { MigrationInterface, QueryRunner } from 'typeorm';

// TypeORM의 @CreateDateColumn·@UpdateDateColumn은 기본값을 now()로 본다.
// 레거시 DB는 created_at이 CURRENT_TIMESTAMP(뜻은 now()와 같음), updated_at은 기본값이 없어서
// migration:generate 때마다 기본값 변경 SQL이 섞여 나오므로 DB 쪽을 now()로 맞춘다.
// - created_at: 표현만 바뀌고 동작은 같다.
// - updated_at: 새로 만든 행에도 생성 시각이 들어간다. (레거시 Prisma @updatedAt도 생성 시 값을 넣었음)
const CREATED_AT_TABLES = [
  'Comment',
  'Communication',
  'Folder',
  'Log',
  'Member',
  'Reference',
  'SubTask',
  'SubTaskAssignee',
  'Task',
  'TaskPriority',
  'User',
  'UserAlarm',
  'UserDevice',
];

const UPDATED_AT_TABLES = [
  'Communication',
  'Log',
  'Reference',
  'SubTask',
  'Task',
  'TaskPriority',
  'User',
  'UserDevice',
];

export class AlignTimestampDefaults1793688764049 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of CREATED_AT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" SET DEFAULT now()`,
      );
    }
    for (const table of UPDATED_AT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "updated_at" SET DEFAULT now()`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of UPDATED_AT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "updated_at" DROP DEFAULT`,
      );
    }
    for (const table of CREATED_AT_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP`,
      );
    }
  }
}
