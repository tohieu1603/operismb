import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { PostCategoryEntity } from './post-category.entity';
import { PostAuthorEntity } from './post-author.entity';

export type PostStatus = 'draft' | 'published' | 'archived';

@Entity('posts')
export class PostEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Basic Fields
  @Column({ type: 'varchar', length: 500, nullable: false })
  title!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subtitle!: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 500, nullable: false })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  excerpt!: string | null;

  @Column({ type: 'text', nullable: false })
  content!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  cover_image!: string | null;

  // Category
  @Index()
  @Column({ type: 'uuid', nullable: false })
  category_id!: string;

  @ManyToOne(() => PostCategoryEntity, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: PostCategoryEntity;

  // Status & Publishing
  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'draft' })
  status!: PostStatus;

  @Index()
  @Column({ type: 'timestamptz', nullable: true })
  published_at!: Date | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  view_count!: number;

  // Author & Tags
  @Column({ type: 'varchar', length: 255, nullable: true })
  author!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  author_id!: string | null;

  @ManyToOne(() => PostAuthorEntity, { nullable: true })
  @JoinColumn({ name: 'author_id' })
  author_info!: PostAuthorEntity | null;

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null;

  // tagsRelation as UUID array (jsonb for flexibility)
  @Column({ type: 'jsonb', nullable: false, default: [] })
  tags_relation!: string[];

  // SEO - Basic Meta
  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  meta_description!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  meta_keywords!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  canonical_url!: string | null;

  // SEO - Open Graph
  @Column({ type: 'varchar', length: 255, nullable: true })
  og_title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  og_description!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  og_image!: string | null;

  // SEO - Twitter Card
  @Column({ type: 'varchar', length: 255, nullable: true })
  twitter_title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  twitter_description!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  twitter_image!: string | null;

  // SEO - Advanced
  @Column({ type: 'varchar', length: 100, nullable: true, default: 'index,follow' })
  robots!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  news_keywords!: string | null;

  @Column({ type: 'boolean', nullable: false, default: false })
  is_evergreen!: boolean;

  // Advanced Options
  @Index()
  @Column({ type: 'boolean', nullable: false, default: false })
  is_featured!: boolean;

  @Column({ type: 'boolean', nullable: false, default: true })
  allow_comments!: boolean;

  @Column({ type: 'integer', nullable: true })
  reading_time!: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  template!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  custom_fields!: Record<string, unknown> | null;

  // Trending & Social
  @Index()
  @Column({ type: 'boolean', nullable: false, default: false })
  is_trending!: boolean;

  @Column({ type: 'integer', nullable: true })
  trending_rank!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  trending_at!: Date | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  share_count!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  like_count!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  comment_count!: number;

  // Content Structure - Auto-generated
  @Column({ type: 'jsonb', nullable: true })
  content_structure!: Record<string, unknown> | null;

  // Content Blocks - Block-based JSON content
  @Column({ type: 'jsonb', nullable: true })
  content_blocks!: Record<string, unknown>[] | null;

  // FAQ
  @Column({ type: 'jsonb', nullable: true })
  faq!: Array<{ question: string; answer: string }> | null;

  @BeforeInsert()
  setPublishedAt(): void {
    if (this.status === 'published' && !this.published_at) {
      this.published_at = new Date();
    }
  }

  @BeforeUpdate()
  updatePublishedAt(): void {
    if (this.status === 'published' && !this.published_at) {
      this.published_at = new Date();
    }
  }

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
