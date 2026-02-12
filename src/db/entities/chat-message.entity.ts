import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  user_id!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ type: 'text', nullable: false })
  conversation_id!: string;

  @Column({ type: 'text', nullable: false })
  role!: 'user' | 'assistant' | 'system';

  @Column({ type: 'text', nullable: false })
  content!: string;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  provider!: string | null;

  @Column({ type: 'integer', nullable: false, default: 0 })
  tokens_used!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  input_tokens!: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  output_tokens!: number;

  @Column({ type: 'text', nullable: true })
  cost!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
