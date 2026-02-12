import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('token_usage')
export class TokenUsageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'text', nullable: false })
  request_type!: 'chat' | 'cronjob' | 'api';

  @Column({ type: 'text', nullable: true })
  request_id!: string | null;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  input_tokens!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  output_tokens!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  total_tokens!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  cost_tokens!: number;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
