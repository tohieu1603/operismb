import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('token_transactions')
export class TokenTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'text', nullable: false })
  type!: 'credit' | 'debit' | 'adjustment';

  @Column({ type: 'integer', nullable: false })
  amount!: number;

  @Column({ type: 'integer', nullable: false })
  balance_after!: number;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  reference_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
