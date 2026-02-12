import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, nullable: false })
  email!: string;

  @Column({ type: 'text', nullable: false })
  password_hash!: string;

  @Column({ type: 'text', nullable: false })
  name!: string;

  @Column({ type: 'text', nullable: false, default: 'user' })
  role!: 'admin' | 'user';

  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_active_at!: Date | null;

  @Column({ type: 'integer', nullable: false, default: 100 })
  token_balance!: number;

  @Column({ type: 'text', nullable: true })
  unique_machine!: string | null;

  @Column({ type: 'text', nullable: true })
  gateway_url!: string | null;

  @Column({ type: 'text', nullable: true })
  gateway_token!: string | null;

  @Column({ type: 'text', nullable: true })
  gateway_hooks_token!: string | null;

  @Column({ type: 'text', nullable: true })
  auth_profiles_path!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
