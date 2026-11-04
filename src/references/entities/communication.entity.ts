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

// 커뮤니케이션 링크 (카카오톡 오픈채팅 등)
@Entity('Communication')
export class Communication {
  @PrimaryGeneratedColumn({
    name: 'comu_id',
    primaryKeyConstraintName: 'Communication_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  url: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => Task, (task) => task.communications, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'Communication_task_id_fkey',
  })
  task: Task;
}
