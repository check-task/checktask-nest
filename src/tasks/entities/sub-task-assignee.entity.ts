import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Member } from './member.entity';
import { SubTask } from './sub-task.entity';

// 기존 DB(Prisma)의 SubTaskAssignee 테이블 — 세부 과제 담당자 (SubTask N:M Member)
@Entity('SubTaskAssignee')
@Index('SubTaskAssignee_sub_task_id_member_id_key', ['subTaskId', 'memberId'], {
  unique: true,
})
export class SubTaskAssignee {
  @PrimaryGeneratedColumn({ name: 'sub_task_assignee_id' })
  id: number;

  @Column({ name: 'sub_task_id' })
  subTaskId: number;

  @Column({ name: 'member_id' })
  memberId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => SubTask, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'sub_task_id',
    foreignKeyConstraintName: 'SubTaskAssignee_sub_task_id_fkey',
  })
  subTask?: SubTask;

  @ManyToOne(() => Member, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'member_id',
    foreignKeyConstraintName: 'SubTaskAssignee_member_id_fkey',
  })
  member?: Member;
}
