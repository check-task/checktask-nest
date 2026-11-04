import { MigrationInterface, QueryRunner } from 'typeorm';

// 알림 목록·안 읽은 개수 조회(WHERE user_id = ? AND alarm_date <= ? ORDER BY alarm_date)용 인덱스
export class AddUserAlarmIndex1793682264280 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "UserAlarm_user_id_alarm_date_idx" ON "UserAlarm" ("user_id", "alarm_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UserAlarm_user_id_alarm_date_idx"`);
  }
}
