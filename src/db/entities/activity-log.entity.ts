import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'login'
  | 'logout'
  | 'upload'
  | 'view';

export type ActivityEntityType =
  | 'post'
  | 'category'
  | 'tag'
  | 'media'
  | 'user'
  | 'settings'
  | 'redirect';

@Entity('activity_logs')
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // External reference to user (no FK to keep decoupled)
  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  action!: ActivityAction;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: false })
  entity_type!: ActivityEntityType;

  // entityId as text since it references different entity tables
  @Column({ type: 'text', nullable: true })
  entity_id!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  entity_name!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  changes!: Array<{
    field: string;
    old_value: unknown;
    new_value: unknown;
  }> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  user_agent!: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
