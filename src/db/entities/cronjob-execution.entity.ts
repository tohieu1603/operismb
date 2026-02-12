import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CronjobEntity } from './cronjob.entity.js';

@Entity('cronjob_executions')
export class CronjobExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  cronjob_id!: string;

  @ManyToOne(() => CronjobEntity)
  @JoinColumn({ name: 'cronjob_id' })
  cronjob!: CronjobEntity;

  @Column({ type: 'text', nullable: false, default: 'running' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: false, default: () => 'now()' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'integer', nullable: true })
  duration_ms!: number | null;

  @Column({ type: 'text', nullable: true })
  output!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'jsonb', nullable: false, default: {} })
  metadata!: Record<string, unknown>;
}
