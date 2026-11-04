import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from './task.entity';

// 유저별 과제 정렬 순서 (rank가 작을수록 위)
@Entity('TaskPriority')
@Index('TaskPriority_user_id_task_id_key', ['userId', 'taskId'], {
  unique: true,
})
export class TaskPriority {
  @PrimaryGeneratedColumn({
    name: 'priority_id',
    primaryKeyConstraintName: 'TaskPriority_pkey',
  })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  @Column({ type: 'int' })
  rank: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'TaskPriority_user_id_fkey',
  })
  user: User;

  @ManyToOne(() => Task, (task) => task.priorities, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'TaskPriority_task_id_fkey',
  })
  task: Task;
}
