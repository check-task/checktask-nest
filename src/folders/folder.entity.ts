import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

// 회원가입 시 만들어지는 기본 폴더 이름
export const DEFAULT_FOLDER_TITLE = '지정안함';

@Entity('Folder')
export class Folder {
  @PrimaryGeneratedColumn({
    name: 'folder_id',
    primaryKeyConstraintName: 'Folder_pkey',
  })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'folder_title', type: 'varchar', length: 10 })
  folderTitle: string;

  @Column({ type: 'varchar', length: 7 })
  color: string;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'Folder_user_id_fkey',
  })
  user: User;
}
