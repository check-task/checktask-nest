import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Folder } from '../../folders/folder.entity';
import { User } from '../../users/entities/user.entity';
import { SubTaskAssignee } from './sub-task-assignee.entity';
import { Task } from './task.entity';

// Member.role 컬럼 값 (레거시 스키마가 boolean으로 저장한다)
export const MEMBER_ROLE = {
  OWNER: false,
  MEMBER: true,
} as const;

// 과제 참여자 (User ↔ Task N:M). 개인 과제는 소유자 한 명만 있다
@Entity('Member')
@Index('Member_user_id_task_id_key', ['userId', 'taskId'], { unique: true })
// 과제의 참여자 조회 (user_id가 앞인 unique 인덱스로는 task_id 단독 조회를 못 탄다)
@Index('Member_task_id_idx', ['taskId'])
export class Member {
  @PrimaryGeneratedColumn({
    name: 'member_id',
    primaryKeyConstraintName: 'Member_pkey',
  })
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'task_id', type: 'int' })
  taskId: number;

  // 참여자가 이 과제를 넣어 둔 폴더 (참여자마다 다를 수 있다)
  @Column({ name: 'folder_id', type: 'int', nullable: true })
  folderId: number | null;

  // false: 소유자(Owner), true: 팀원 → MEMBER_ROLE 사용
  @Column({ type: 'boolean' })
  role: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'Member_user_id_fkey',
  })
  user: User;

  @ManyToOne(() => Task, (task) => task.members, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'task_id',
    foreignKeyConstraintName: 'Member_task_id_fkey',
  })
  task: Task;

  @ManyToOne(() => Folder, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'folder_id',
    foreignKeyConstraintName: 'Member_folder_id_fkey',
  })
  folder: Folder | null;

  // 이 참여자가 담당한 세부 과제
  @OneToMany(() => SubTaskAssignee, (assignee) => assignee.member)
  assignedSubTasks: SubTaskAssignee[];
}
