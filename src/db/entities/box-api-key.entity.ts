import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BoxEntity } from './box.entity';

@Entity('box_api_keys')
export class BoxApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  box_id!: string;

  @ManyToOne(() => BoxEntity)
  @JoinColumn({ name: 'box_id' })
  box!: BoxEntity;

  @Column({ type: 'text', nullable: false })
  key_hash!: string;

  @Column({ type: 'text', nullable: false })
  key_prefix!: string;

  @Column({ type: 'text', nullable: false, default: 'API Key' })
  name!: string;

  @Column({ type: 'boolean', nullable: false, default: true })
  is_active!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at!: Date | null;
}
