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
import { PostCategoryEntity } from './post-category.entity';

@Entity('dictionary_terms')
export class DictionaryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: false })
  term!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 1000, nullable: false })
  definition!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  synonym!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  related_terms!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  examples!: string[] | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  category_id!: string | null;

  @ManyToOne(() => PostCategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: PostCategoryEntity | null;

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  source!: string | null;

  @Column({ type: 'text', nullable: true })
  image_url!: string | null;

  @Column({ type: 'text', nullable: true })
  audio_url!: string | null;

  @Column({ type: 'text', nullable: true })
  video_url!: string | null;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: false })
  is_featured!: boolean;

  @Column({ type: 'integer', nullable: false, default: 0 })
  view_count!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  sort_order!: number;

  // SEO nested object stored as jsonb
  @Column({ type: 'jsonb', nullable: true })
  seo!: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  } | null;

  // External user references (no FK to keep decoupled)
  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
