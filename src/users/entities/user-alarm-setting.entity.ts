import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

// 마감 알림을 몇 시간 전에 보낼지 정하는 유저별 설정 (기본 24시간)
export const DEFAULT_ALARM_HOURS = 24;

// 기존 DB(Prisma)의 UserAlarmSetting 테이블 — 유저와 1:1
@Entity('UserAlarmSetting')
@Index('UserAlarmSetting_user_id_key', ['userId'], { unique: true })
export class UserAlarmSetting {
  @PrimaryGeneratedColumn({ name: 'user_alarm_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  // 과제 마감 N시간 전 알림
  @Column({ name: 'deadline_alarm', default: DEFAULT_ALARM_HOURS })
  deadlineAlarm: number;

  // 세부 과제 마감 N시간 전 알림
  @Column({ name: 'task_alarm', default: DEFAULT_ALARM_HOURS })
  taskAlarm: number;

  // 유저당 1개는 위 unique 인덱스가 보장한다.
  // (@OneToOne은 DB에 없는 unique 제약을 따로 만들려고 해서 ManyToOne으로 둔다)
  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserAlarmSetting_user_id_fkey',
  })
  user?: User;
}
