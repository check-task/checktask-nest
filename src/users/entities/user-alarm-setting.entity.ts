import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

// 유저별 알림 설정 (1:1). 값은 마감 몇 시간 전에 알릴지(시간 단위)
@Entity('UserAlarmSetting')
@Index('UserAlarmSetting_user_id_key', ['userId'], { unique: true })
export class UserAlarmSetting {
  @PrimaryGeneratedColumn({
    name: 'user_alarm_id',
    primaryKeyConstraintName: 'UserAlarmSetting_pkey',
  })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  // 과제 마감 알림
  @Column({ name: 'deadline_alarm', type: 'int', default: 24 })
  deadlineAlarm: number;

  // 세부 과제 마감 알림
  @Column({ name: 'task_alarm', type: 'int', default: 24 })
  taskAlarm: number;

  // OneToOne은 TypeORM이 별도 unique 제약(REL_)을 만들어 기존 스키마와 달라지므로 ManyToOne + unique 인덱스로 매핑한다
  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserAlarmSetting_user_id_fkey',
  })
  user: User;
}
