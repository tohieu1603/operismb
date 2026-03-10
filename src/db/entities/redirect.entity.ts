import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type RedirectStatus = 301 | 302 | 307 | 308;

@Entity('redirects')
export class RedirectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 1000, nullable: false, unique: true })
  from_path!: string;

  @Column({ type: 'varchar', length: 1000, nullable: false })
  to_path!: string;

  @Column({ type: 'integer', nullable: false, default: 301 })
  status_code!: RedirectStatus;

  @Index()
  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Column({ type: 'integer', nullable: false, default: 0 })
  hit_count!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
