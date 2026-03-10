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

@Entity('keywords')
export class KeywordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 255, nullable: false })
  keyword!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  language!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country!: string | null;

  @Column({ type: 'integer', nullable: true })
  search_volume!: number | null;

  @Column({ type: 'integer', nullable: true })
  difficulty!: number | null;

  @Column({ type: 'integer', nullable: true })
  current_rank!: number | null;

  @Column({ type: 'integer', nullable: true })
  previous_rank!: number | null;

  @Column({ type: 'integer', nullable: true })
  best_rank!: number | null;

  @Index()
  @Column({ type: 'integer', nullable: true })
  current_position!: number | null;

  @Column({ type: 'integer', nullable: true })
  previous_position!: number | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  position_change!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  target_url!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  post_id!: string | null;

  @ManyToOne(() => PostEntity, { nullable: true })
  @JoinColumn({ name: 'post_id' })
  post!: PostEntity | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  clicks!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  impressions!: number;

  @Column({ type: 'float', nullable: false, default: 0 })
  ctr!: number;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_tracking!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_checked!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_checked_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  ranking_history!: Array<{
    date: string;
    position: number;
    clicks: number;
    impressions: number;
  }> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
