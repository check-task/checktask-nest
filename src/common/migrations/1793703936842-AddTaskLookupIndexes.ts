import { MigrationInterface, QueryRunner } from 'typeorm';

// 과제 조회용 인덱스: 초대 코드로 과제 찾기, 과제의 참여자·세부 과제 조회

export class AddTaskLookupIndexes1793703936842 implements MigrationInterface {
  name = 'AddTaskLookupIndexes1793703936842';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "Task_invite_code_idx" ON "Task"  ("invite_code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "Member_task_id_idx" ON "Member"  ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "SubTask_task_id_idx" ON "SubTask"  ("task_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."SubTask_task_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."Member_task_id_idx"`);
    await queryRunner.query(`DROP INDEX "public"."Task_invite_code_idx"`);
  }
}
