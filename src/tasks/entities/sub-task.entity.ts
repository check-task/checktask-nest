import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubTaskStatus } from '../../common/enums';
import { Task } from './task.entity';

// 기존 DB(Prisma)의 SubTask 테이블
@Entity('SubTask')
export class SubTask {
  @PrimaryGeneratedColumn({ name: 'sub_task_id' })
  id: number;

  @Column({ name: 'task_id' })
  taskId: number;

  @Column({ length: 100 })
  title: string;

  // 미지정(null)이면 마감 알림을 만들지 않는다
  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({
    type: 'enum',
    enum: SubTaskStatus,
    enumName: 'SubTaskStatus',
    default: SubTaskStatus.PENDING,
  })
  status: SubTaskStatus;

  @Column({ name: 'is_alarm', default: true })
  isAlarm: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'SubTask_task_id_fkey',
  })
  task?: Task;
}
