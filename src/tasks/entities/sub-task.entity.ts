import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Comment } from '../../comments/comment.entity';
import { SubTaskStatus } from '../../common/enums';
import { SubTaskAssignee } from './sub-task-assignee.entity';
import { Task } from './task.entity';

// 세부 과제 제목 최대 길이 (DB varchar(100))
export const SUB_TASK_TITLE_MAX_LENGTH = 100;

@Entity('SubTask')
// 과제의 세부 과제 조회
@Index('SubTask_task_id_idx', ['taskId'])
export class SubTask {
  @PrimaryGeneratedColumn({
    name: 'sub_task_id',
    primaryKeyConstraintName: 'SubTask_pkey',
  })
  id: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  @Column({ type: 'varchar', length: SUB_TASK_TITLE_MAX_LENGTH })
  title: string;

  // 마감일 미지정이면 null (마감 알림도 만들지 않는다)
  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({
    type: 'enum',
    enum: SubTaskStatus,
    enumName: 'SubTaskStatus',
    default: SubTaskStatus.PENDING,
  })
  status: SubTaskStatus;

  @Column({ name: 'is_alarm', type: 'boolean', default: true })
  isAlarm: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date | null;

  @ManyToOne(() => Task, (task) => task.subTasks, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'SubTask_task_id_fkey',
  })
  task: Task;

  // 담당자 (여러 명 가능, 없을 수도 있다)
  @OneToMany(() => SubTaskAssignee, (assignee) => assignee.subTask)
  assignees: SubTaskAssignee[];

  @OneToMany(() => Comment, (comment) => comment.subTask)
  comments: Comment[];
}
