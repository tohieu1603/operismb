import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('post_authors')
export class PostAuthorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Basic info
  @Column({ type: 'varchar', length: 200, nullable: false })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: false, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  avatar_url!: string | null;

  // E-E-A-T signals
  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  short_bio!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  job_title!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  company!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  // Dynamic CV-like content (stored as jsonb)
  @Column({ type: 'jsonb', nullable: false, default: [] })
  expertise!: string[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  experience!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  education!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  certifications!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  achievements!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  skills!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  publications!: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: false, default: [] })
  articles!: Record<string, unknown>[];

  // Legacy fields
  @Column({ type: 'varchar', length: 500, nullable: true })
  credentials!: string | null;

  @Column({ type: 'integer', nullable: true })
  years_experience!: number | null;

  // Social proof
  @Column({ type: 'varchar', length: 500, nullable: true })
  website!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  twitter!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  linkedin!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  facebook!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  github!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  youtube!: string | null;

  @Column({ type: 'jsonb', nullable: false, default: [] })
  same_as!: string[];

  // Relation to user (external reference, no FK constraint to keep decoupled)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  // SEO
  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  meta_description!: string | null;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: false })
  is_featured!: boolean;

  @Column({ type: 'integer', nullable: false, default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
