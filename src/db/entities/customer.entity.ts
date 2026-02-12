import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, nullable: false })
  email!: string;

  @Column({ type: 'text', nullable: false })
  password_hash!: string;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  company!: string | null;

  @Column({ type: 'text', nullable: false, default: 'starter' })
  plan!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'text', nullable: true })
  stripe_customer_id!: string | null;

  @Column({ type: 'text', nullable: true })
  subscription_status!: string | null;

  @Column({ type: 'integer', nullable: false, default: 5 })
  max_boxes!: number;

  @Column({ type: 'integer', nullable: false, default: 3 })
  max_agents_per_box!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
