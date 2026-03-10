import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SeoLogAction =
  | 'submit_index'
  | 'check_index'
  | 'update_meta'
  | 'generate_sitemap'
  | 'check_ranking'
  | 'ai_analyze'
  | 'seo_analyze'
  | 'pagespeed_check'
  | 'redirect_create'
  | 'redirect_update'
  | 'robots_update'
  | 'schema_generate'
  | 'content_optimize'
  | 'keyword_track'
  | 'audit_run'
  | 'scheduled_task'
  | 'broken_link_check'
  | 'content_freshness'
  | 'report_generated';

export type SeoLogEntityType = 'post' | 'category' | 'tag' | 'page' | 'site' | 'keyword';
export type SeoLogStatus = 'success' | 'failed' | 'pending' | 'skipped' | 'warning' | 'info';

@Entity('seo_logs')
export class SeoLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: false })
  action!: SeoLogAction;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  entity_type!: SeoLogEntityType | null;

  // entityId stored as text since it can reference different entity tables
  @Column({ type: 'text', nullable: true })
  entity_id!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  entity_url!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'pending' })
  status!: SeoLogStatus;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  api_response!: Record<string, unknown> | null;

  @Column({ type: 'integer', nullable: true })
  duration!: number | null;

  // External reference to user (no FK to keep decoupled)
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: false })
  is_scheduled!: boolean;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
