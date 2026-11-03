import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';

// 회의록
@Entity('Log')
export class Log {
  @PrimaryGeneratedColumn({
    name: 'log_id',
    primaryKeyConstraintName: 'Log_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  // 회의 날짜 (DATE 컬럼은 pg 드라이버가 'YYYY-MM-DD' 문자열로 읽는다)
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  agenda: string | null;

  @Column({ type: 'text', nullable: true })
  conclusion: string | null;

  @Column({ type: 'text', nullable: true })
  discussion: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => Task, (task) => task.logs, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'task_id', foreignKeyConstraintName: 'Log_task_id_fkey' })
  task: Task;
}
