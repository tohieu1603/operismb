import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('page_contents')
export class PageContentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false, unique: true })
  page_slug!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  page_name!: string;

  @Column({ type: 'jsonb', nullable: false })
  content!: Record<string, unknown>;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
