import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BoxEntity } from './box.entity.js';
import { CustomerEntity } from './customer.entity.js';

@Entity('agents')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  box_id!: string;

  @ManyToOne(() => BoxEntity)
  @JoinColumn({ name: 'box_id' })
  box!: BoxEntity;

  @Column({ type: 'uuid', nullable: false })
  customer_id!: string;

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: false })
  model!: string;

  @Column({ type: 'text', nullable: true })
  system_prompt!: string | null;

  @Column({ type: 'text', nullable: false, default: 'active' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_active_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
