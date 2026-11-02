import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Provider } from '../../common/enums';
import { Role } from '../role.enum';

// 기존 DB(Prisma)의 User 테이블
@Entity('User')
@Index('User_email_key', ['email'], { unique: true })
@Index('User_provider_provider_id_key', ['provider', 'providerId'], {
  unique: true,
})
@Index('User_deleted_at_idx', ['deletedAt'])
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  id: number;

  @Column({ length: 30 })
  nickname: string;

  @Column({ name: 'phone_num', length: 20 })
  phoneNum: string;

  @Column({ length: 50 })
  email: string;

  @Column({
    name: 'profile_image',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  profileImage: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({ type: 'enum', enum: Role, enumName: 'Role', default: Role.USER })
  role: Role;

  @Column({
    type: 'enum',
    enum: Provider,
    enumName: 'Provider',
    nullable: true,
  })
  provider: Provider | null;

  @Column({ name: 'provider_id', type: 'varchar', length: 100, nullable: true })
  providerId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
