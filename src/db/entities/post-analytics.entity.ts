import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export type AnalyticsEventType =
  | 'page_view'
  | 'post_view'
  | 'category_view'
  | 'faq_click'
  | 'toc_click'
  | 'search'
  | 'link_click'
  | 'share_facebook'
  | 'share_twitter'
  | 'share_copy_link'
  | 'tag_click'
  | 'related_post_click'
  | 'category_link_click';

export type AnalyticsEntityType = 'post' | 'category' | 'page' | 'faq' | 'link' | 'toc' | 'tag';

@Entity('post_analytics_events')
export class PostAnalyticsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: false })
  event_type!: AnalyticsEventType;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  entity_type!: AnalyticsEntityType;

  // entityId is a UUID reference to different entity tables
  @Column({ type: 'uuid', nullable: true })
  entity_id!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity_slug!: string | null;

  // Visitor tracking
  @Column({ type: 'varchar', length: 64, nullable: false })
  session_id!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  user_agent!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  referrer!: string | null;

  // Date for daily aggregation
  @Index()
  @Column({ type: 'timestamptz', nullable: false })
  date!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('post_daily_stats')
@Unique(['date', 'entity_type', 'entity_id'])
export class PostDailyStatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'timestamptz', nullable: false })
  date!: Date;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  entity_type!: 'post' | 'category' | 'page';

  @Column({ type: 'uuid', nullable: true })
  entity_id!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity_slug!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  total_views!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  unique_views!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
