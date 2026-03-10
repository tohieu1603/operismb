import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PostEntity } from './post.entity';

@Entity('seo_scores')
export class SeoScoreEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: false })
  post_id!: string;

  @ManyToOne(() => PostEntity, { nullable: false })
  @JoinColumn({ name: 'post_id' })
  post!: PostEntity;

  @Index()
  @Column({ type: 'integer', nullable: false, default: 0 })
  overall_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  title_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  meta_description_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  content_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  heading_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  keyword_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  readability_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  internal_link_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  image_score!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  technical_score!: number;

  @Column({ type: 'jsonb', nullable: true })
  analysis!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  suggestions!: Array<{
    type: 'error' | 'warning' | 'success' | 'info';
    category: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  ai_suggestions!: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  checked_at!: Date;
}
