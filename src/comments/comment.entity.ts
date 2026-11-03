import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { User } from '../users/entities/user.entity';

@Entity('Comment')
export class Comment {
  @PrimaryGeneratedColumn({
    name: 'comment_id',
    primaryKeyConstraintName: 'Comment_pkey',
  })
  id: number;

  @Column({ name: 'sub_task_id', type: 'int' })
  subTaskId: number;

  // 작성자
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => SubTask, (subTask) => subTask.comments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'sub_task_id',
    foreignKeyConstraintName: 'Comment_sub_task_id_fkey',
  })
  subTask: SubTask;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'Comment_user_id_fkey',
  })
  user: User;
}
