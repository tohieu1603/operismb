import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('deposit_orders')
export class DepositOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'text', nullable: false, unique: true })
  order_code!: string;

  @Column({ type: 'integer', nullable: false })
  token_amount!: number;

  @Column({ type: 'integer', nullable: false })
  amount_vnd!: number;

  @Column({ type: 'text', nullable: false, default: 'pending' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  payment_method!: string | null;

  @Column({ type: 'text', nullable: true })
  payment_reference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: false })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
