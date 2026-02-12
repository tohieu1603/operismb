import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CustomerEntity } from './customer.entity.js';

@Entity('boxes')
export class BoxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  customer_id!: string;

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

  @Column({ type: 'text', nullable: false })
  api_key_hash!: string;

  @Column({ type: 'text', nullable: true, unique: true })
  hardware_id!: string | null;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  hostname!: string | null;

  @Column({ type: 'text', nullable: true })
  os!: string | null;

  @Column({ type: 'text', nullable: true })
  arch!: string | null;

  @Column({ type: 'text', nullable: false, default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_seen_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  last_ip!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
