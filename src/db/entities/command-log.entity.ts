import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BoxEntity } from './box.entity.js';

@Entity('commands_log')
export class CommandLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  box_id!: string;

  @ManyToOne(() => BoxEntity)
  @JoinColumn({ name: 'box_id' })
  box!: BoxEntity;

  @Column({ type: 'text', nullable: true })
  agent_id!: string | null;

  @Column({ type: 'text', nullable: false })
  command_id!: string;

  @Column({ type: 'text', nullable: false })
  command_type!: string;

  @Column({ type: 'jsonb', nullable: true })
  command_payload!: Record<string, unknown> | null;

  @Column({ type: 'boolean', nullable: true })
  success!: boolean | null;

  @Column({ type: 'jsonb', nullable: true })
  response_payload!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamptz', nullable: false, default: () => 'NOW()' })
  sent_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  received_at!: Date | null;

  @Column({ type: 'integer', nullable: true })
  duration_ms!: number | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;
}
