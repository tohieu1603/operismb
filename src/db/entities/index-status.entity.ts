import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PostEntity } from './post.entity';

export type IndexStatusType = 'pending' | 'submitted' | 'indexed' | 'not_indexed' | 'error' | 'removed';
export type UrlType = 'post' | 'category' | 'tag' | 'page' | 'other';
export type SubmissionMethod = 'indexing_api' | 'sitemap' | 'manual' | 'url_inspection';

@Entity('index_statuses')
export class IndexStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 500, nullable: false })
  url!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'pending' })
  status!: IndexStatusType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  post_id!: string | null;

  @ManyToOne(() => PostEntity, { nullable: true })
  @JoinColumn({ name: 'post_id' })
  post!: PostEntity | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'post' })
  url_type!: UrlType;

  @Column({ type: 'timestamptz', nullable: true })
  submitted_at!: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  submission_method!: SubmissionMethod | null;

  @Column({ type: 'timestamptz', nullable: true })
  indexed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_crawled_at!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  crawl_status!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  indexing_status!: string | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  retry_count!: number;

  @Column({ type: 'boolean', nullable: true })
  is_mobile_friendly!: boolean | null;

  @Column({ type: 'integer', nullable: true })
  mobile_score!: number | null;

  @Column({ type: 'integer', nullable: true })
  desktop_score!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_checked!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_checked_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
