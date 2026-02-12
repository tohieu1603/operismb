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

@Entity('cronjobs')
export class CronjobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  box_id!: string | null;

  @Column({ type: 'uuid', nullable: false })
  customer_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: UserEntity;

  @Column({ type: 'text', nullable: false, default: 'main' })
  agent_id!: string;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: false, default: 'cron' })
  schedule_type!: string;

  @Column({ type: 'text', nullable: false })
  schedule_expr!: string;

  @Column({ type: 'text', nullable: true })
  schedule_tz!: string | null;

  @Column({ type: 'integer', nullable: true })
  schedule_interval_ms!: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => v == null ? null : Number(v) } })
  schedule_at_ms!: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: { to: (v: number | null) => v, from: (v: string | null) => v == null ? null : Number(v) } })
  schedule_anchor_ms!: number | null;

  @Column({ type: 'text', nullable: false, default: 'main' })
  session_target!: string;

  @Column({ type: 'text', nullable: false, default: 'next-heartbeat' })
  wake_mode!: string;

  @Column({ type: 'text', nullable: false, default: 'systemEvent' })
  payload_kind!: string;

  @Column({ type: 'text', nullable: false })
  message!: string;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  thinking!: string | null;

  @Column({ type: 'integer', nullable: true })
  timeout_seconds!: number | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  allow_unsafe_external_content!: boolean;

  @Column({ type: 'boolean', nullable: false, default: true })
  deliver!: boolean;

  @Column({ type: 'text', nullable: true })
  channel!: string | null;

  @Column({ type: 'text', nullable: true })
  to_recipient!: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  best_effort_deliver!: boolean;

  @Column({ type: 'text', nullable: true })
  isolation_post_to_main_prefix!: string | null;

  @Column({ type: 'text', nullable: true })
  isolation_post_to_main_mode!: string | null;

  @Column({ type: 'integer', nullable: true })
  isolation_post_to_main_max_chars!: number | null;

  @Column({ type: 'boolean', nullable: false, default: true })
  enabled!: boolean;

  @Column({ type: 'boolean', nullable: false, default: false })
  delete_after_run!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  running_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_run_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  last_status!: string | null;

  @Column({ type: 'text', nullable: true })
  last_error!: string | null;

  @Column({ type: 'integer', nullable: true })
  last_duration_ms!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  next_run_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  metadata!: Record<string, unknown>;
}
