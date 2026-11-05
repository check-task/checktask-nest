import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

// 사용자 이용 약관 설정
@Entity('UserAgreement')
@Index('UserAgreement_user_id_key', ['userId'], { unique: true })
export class UserAgreement {
  @PrimaryGeneratedColumn({ name: 'agreement_id' })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  // 필수 약관 동의일
  @Column({ name: 'terms_agreed_at', type: 'date' })
  termsAgreedAt: string;

  // 푸시 알림 동의 (선택)
  @Column({ name: 'push_updated_at', type: 'date', nullable: true })
  pushUpdatedAt: string | null;

  @Column({ name: 'is_push', default: false })
  isPush: boolean;

  // 제3자 정보 제공 동의 (선택)
  @Column({ name: 'third_party_updated_at', type: 'date', nullable: true })
  thirdPartyUpdatedAt: string | null;

  @Column({ name: 'is_third_party', default: false })
  isThirdParty: boolean;

  // 마케팅 수신 동의 (선택)
  @Column({ name: 'marketing_updated_at', type: 'date', nullable: true })
  marketingUpdatedAt: string | null;

  @Column({ name: 'is_marketing', default: false })
  isMarketing: boolean;

  // (@OneToOne은 DB에 없는 unique 제약을 따로 만들려고 해서 ManyToOne으로 둔다)
  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'UserAgreement_user_id_fkey',
  })
  user?: User;
}
