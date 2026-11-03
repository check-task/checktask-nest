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

// 세부 과제 담당자 (SubTask ↔ Member N:M). 레거시 20260809 마이그레이션에서 SubTask.assignee_id를 대체했다
@Entity('SubTaskAssignee')
@Index('SubTaskAssignee_sub_task_id_member_id_key', ['subTaskId', 'memberId'], {
  unique: true,
})
export class SubTaskAssignee {
  @PrimaryGeneratedColumn({
    name: 'sub_task_assignee_id',
    primaryKeyConstraintName: 'SubTaskAssignee_pkey',
  })
  id: number;

  @Column({ name: 'sub_task_id', type: 'int' })
  subTaskId: number;

  // 담당자의 Member.id (User.id가 아님)
  @Column({ name: 'member_id', type: 'int' })
  memberId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => SubTask, (subTask) => subTask.assignees, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'sub_task_id',
    foreignKeyConstraintName: 'SubTaskAssignee_sub_task_id_fkey',
  })
  subTask: SubTask;

  // 참여자가 과제에서 빠지면 담당도 함께 삭제된다
  @ManyToOne(() => Member, (member) => member.assignedSubTasks, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'member_id',
    foreignKeyConstraintName: 'SubTaskAssignee_member_id_fkey',
  })
  member: Member;
}
