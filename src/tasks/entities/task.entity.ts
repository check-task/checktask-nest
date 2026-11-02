import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskStatus, TaskType } from '../../common/enums';

// 기존 DB(Prisma)의 Task 테이블
@Entity('Task')
export class Task {
  @PrimaryGeneratedColumn({ name: 'task_id' })
  id: number;

  @Column({ length: 10 })
  title: string;

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column({ type: 'enum', enum: TaskType, enumName: 'TaskType' })
  type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @Column({ name: 'is_alarm', default: true })
  isAlarm: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @Column({ name: 'invite_code', type: 'varchar', length: 50, nullable: true })
  inviteCode: string | null;

  @Column({ name: 'invite_expired', type: 'timestamp', nullable: true })
  inviteExpiredAt: Date | null;
}
