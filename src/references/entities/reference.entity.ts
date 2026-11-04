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

// 자료 (링크 또는 파일)
@Entity('Reference')
export class Reference {
  @PrimaryGeneratedColumn({
    name: 'data_id',
    primaryKeyConstraintName: 'Reference_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  url: string | null;

  @Column({ name: 'file_url', type: 'varchar', length: 255, nullable: true })
  fileUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => Task, (task) => task.references, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'Reference_task_id_fkey',
  })
  task: Task;
}
