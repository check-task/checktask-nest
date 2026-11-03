import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubTask } from '../tasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { AlarmType } from '../common/enums';

@Entity('UserAlarm')
export class UserAlarm {
  @PrimaryGeneratedColumn({
    name: 'alarm_id',
    primaryKeyConstraintName: 'UserAlarm_pkey',
  })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  // 과제 알림이 아니면 null
  @Column({ name: 'task_id', type: 'int', nullable: true })
  taskId: number | null;

  // 세부 과제 알림이 아니면 null
  @Column({ name: 'sub_task_id', type: 'int', nullable: true })
  subTaskId: number | null;

  // 레거시 데이터 중 type이 없는 알림이 있어 nullable
  @Column({
    type: 'enum',
    enum: AlarmType,
    enumName: 'AlarmType',
    nullable: true,
  })
  type: AlarmType | null;

  @Column({ type: 'varchar', length: 50 })
  title: string;

  @Column({ name: 'alarm_content', type: 'varchar', length: 50 })
  alarmContent: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  // 알림을 보낼 시각
  @Column({ name: 'alarm_date', type: 'timestamp' })
  alarmDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserAlarm_user_id_fkey',
  })
  user: User;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'UserAlarm_task_id_fkey',
  })
  task: Task | null;

  @ManyToOne(() => SubTask, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'sub_task_id',
    foreignKeyConstraintName: 'UserAlarm_sub_task_id_fkey',
  })
  subTask: SubTask | null;
}
