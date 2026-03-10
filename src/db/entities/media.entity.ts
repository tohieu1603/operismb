import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MediaType = 'image' | 'video' | 'document' | 'audio' | 'other';

@Entity('media')
export class MediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  filename!: string;

  @Column({ type: 'varchar', length: 500, nullable: false })
  original_name!: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  mime_type!: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false, default: 'other' })
  type!: MediaType;

  @Column({ type: 'integer', nullable: false })
  size!: number;

  @Column({ type: 'varchar', length: 1000, nullable: false })
  url!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  thumbnail_url!: string | null;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  alt_text!: string | null;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  // External reference to uploading user (no FK to keep decoupled)
  @Column({ type: 'uuid', nullable: true })
  uploaded_by!: string | null;

  // External reference to post_categories (no FK to keep decoupled)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  category_id!: string | null;

  // Array of usage references: { entityType, entityId, field }
  @Column({ type: 'jsonb', nullable: true })
  used_in!: Array<{ entityType: string; entityId: string; field: string }> | null;

  // Array of page/section assignments
  @Column({ type: 'jsonb', nullable: false, default: [] })
  assignments!: Array<{ pageSlug: string; sectionKey: string; elementId?: string }>;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: true })
  folder!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
