import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Communication } from '../../references/entities/communication.entity';
import { Log } from '../../references/entities/log.entity';
import { Reference } from '../../references/entities/reference.entity';
import { TaskStatus } from '../task-status.enum';
import { TaskType } from '../../common/enums';
import { Member } from './member.entity';
import { SubTask } from './sub-task.entity';
import { TaskPriority } from './task-priority.entity';

// 과제 제목 최대 길이 (DB varchar(10))
export const TASK_TITLE_MAX_LENGTH = 10;

@Entity('Task')
// 초대 코드로 팀 과제 조회 (POST /task/join)
@Index('Task_invite_code_idx', ['inviteCode'])
export class Task {
  @PrimaryGeneratedColumn({
    name: 'task_id',
    primaryKeyConstraintName: 'Task_pkey',
  })
  id: number;

  @Column({ type: 'varchar', length: TASK_TITLE_MAX_LENGTH })
  title: string;

  @Column({ type: 'timestamp' })
  deadline: Date;

  @Column({ type: 'enum', enum: TaskType, enumName: 'TaskType' })
  type: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, enumName: 'TaskStatus' })
  status: TaskStatus;

  @Column({ name: 'is_alarm', type: 'boolean', default: true })
  isAlarm: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  // 팀 과제 초대 코드
  @Column({ name: 'invite_code', type: 'varchar', length: 50, nullable: true })
  inviteCode: string | null;

  // 초대 코드 만료 시각
  @Column({ name: 'invite_expired', type: 'timestamp', nullable: true })
  inviteExpiredAt: Date | null;

  @OneToMany(() => Member, (member) => member.task)
  members: Member[];

  @OneToMany(() => SubTask, (subTask) => subTask.task)
  subTasks: SubTask[];

  @OneToMany(() => TaskPriority, (priority) => priority.task)
  priorities: TaskPriority[];

  @OneToMany(() => Reference, (reference) => reference.task)
  references: Reference[];

  @OneToMany(() => Log, (log) => log.task)
  logs: Log[];

  @OneToMany(() => Communication, (communication) => communication.task)
  communications: Communication[];
}
