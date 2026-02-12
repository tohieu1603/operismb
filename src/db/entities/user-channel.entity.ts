import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("user_channels")
@Unique(["user_id", "channel", "account_label"])
export class UserChannelEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", nullable: false })
  user_id!: string;

  @Column({ type: "text", nullable: false, default: "zalozcajs" })
  channel!: string;

  @Column({ type: "text", nullable: false, default: "default" })
  account_label!: string;

  @Column({ type: "text", nullable: true })
  zalo_uid!: string | null;

  @Column({ type: "text", nullable: true })
  zalo_name!: string | null;

  @Column({ type: "jsonb", nullable: true })
  credentials!: Record<string, unknown> | null;

  @Column({ type: "boolean", nullable: false, default: false })
  is_connected!: boolean;

  @Column({ type: "timestamptz", nullable: true })
  connected_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;
}
