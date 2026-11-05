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
import { DeviceType } from '../enums/device-type.enum';
import { User } from './user.entity';

// 유저 기기 (FCM 토큰)
@Entity('UserDevice')
@Index('UserDevice_user_id_device_type_key', ['userId', 'deviceType'], {
  unique: true,
})
export class UserDevice {
  @PrimaryGeneratedColumn({ name: 'device_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'fcm_token', type: 'varchar', length: 255 })
  fcmToken: string;

  @Column({
    name: 'device_type',
    type: 'enum',
    enum: DeviceType,
    enumName: 'DeviceType',
  })
  deviceType: DeviceType;

  @Column({ name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserDevice_user_id_fkey',
  })
  user: User;
}
