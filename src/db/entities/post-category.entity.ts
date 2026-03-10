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

@Entity('post_categories')
export class PostCategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'uuid', nullable: true })
  parent_id!: string | null;

  @ManyToOne(() => PostCategoryEntity, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: PostCategoryEntity | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  sort_order!: number;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Column({ type: 'integer', nullable: false, default: 0 })
  view_count!: number;

  @Column({ type: 'varchar', length: 70, nullable: true })
  seo_title!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  seo_description!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  og_image!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  level!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
