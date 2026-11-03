import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Folder } from '../../folders/folder.entity';
import { User } from '../../users/entities/user.entity';
import { Task } from './task.entity';

// 기존 DB(Prisma)의 Member 테이블 — 과제 참여자 (개인 과제도 본인이 owner로 들어감)
@Entity('Member')
@Index('Member_user_id_task_id_key', ['userId', 'taskId'], { unique: true })
export class Member {
  @PrimaryGeneratedColumn({ name: 'member_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'task_id' })
  taskId: number;

  @Column({ name: 'folder_id', type: 'integer', nullable: true })
  folderId: number | null;

  // false: owner, true: member (레거시 값 그대로)
  @Column()
  role: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'Member_user_id_fkey',
  })
  user?: User;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'Member_task_id_fkey',
  })
  task?: Task;

  // 과제를 넣어 둔 폴더 (없으면 null)
  @ManyToOne(() => Folder, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'folder_id',
    foreignKeyConstraintName: 'Member_folder_id_fkey',
  })
  folder?: Folder | null;
}
