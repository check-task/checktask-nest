import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

// 기존 DB(Prisma)의 Folder 테이블
@Entity('Folder')
export class Folder {
  @PrimaryGeneratedColumn({ name: 'folder_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'folder_title', type: 'varchar', length: 10 })
  folderTitle: string;

  // #RRGGBB
  @Column({ type: 'varchar', length: 7 })
  color: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  // 폴더 정렬 순서
  @Column({ default: 0 })
  rank: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'Folder_user_id_fkey',
  })
  user?: User;
}
