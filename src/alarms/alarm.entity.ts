import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { AlarmType } from './alarm-type.enum';

// title·alarm_content 컬럼 길이 (varchar(50))
export const ALARM_TEXT_MAX_LENGTH = 50;

// 기존 DB(Prisma)의 UserAlarm 테이블
@Entity('UserAlarm')
// 알림 목록·안 읽은 개수 조회용 (마이그레이션 AddUserAlarmIndex)
@Index('UserAlarm_user_id_alarm_date_idx', ['userId', 'alarmDate'])
export class UserAlarm {
  @PrimaryGeneratedColumn({ name: 'alarm_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'task_id', type: 'integer', nullable: true })
  taskId: number | null;

  @Column({ name: 'sub_task_id', type: 'integer', nullable: true })
  subTaskId: number | null;

  @Column({
    type: 'enum',
    enum: AlarmType,
    enumName: 'AlarmType',
    nullable: true,
  })
  type: AlarmType | null;

  @Column({ length: ALARM_TEXT_MAX_LENGTH })
  title: string;

  @Column({ name: 'alarm_content', length: ALARM_TEXT_MAX_LENGTH })
  alarmContent: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  // 알림을 보낼 시각 (UTC). 이 시각이 지나야 목록에 보이고 푸시가 나간다
  @Column({ name: 'alarm_date', type: 'timestamp' })
  alarmDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserAlarm_user_id_fkey',
  })
  user?: User;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'UserAlarm_task_id_fkey',
  })
  task?: Task | null;

  @ManyToOne(() => SubTask, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'sub_task_id',
    foreignKeyConstraintName: 'UserAlarm_sub_task_id_fkey',
  })
  subTask?: SubTask | null;
}
