
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from "typeorm";
import { User } from "./user.entity";

export enum TransferDirection {
  GREATER_EQUAL = ">=",
  LESS_EQUAL = "<=",
}

export enum TransferStatus {
  PENDING = "PENDING",
  EXECUTED = "EXECUTED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

@Entity("conditional_transfers")
export class ConditionalTransfer {
  @PrimaryGeneratedColumn("uuid")
  order_id: string;

  @Column({ type: "varchar", length: 10 })
  from_currency: string;

  @Column({ type: "varchar", length: 10 })
  to_currency: string;

  @Column({ type: "varchar", length: 50 })
  from_network: string;

  @Column({ type: "varchar", length: 50 })
  to_network: string;

  @Column("numeric", { precision: 30, scale: 10 })
  amount: string;

  @Column("numeric", { precision: 30, scale: 10 })
  target_rate: string;

  @Column({ type: "enum", enum: TransferDirection })
  direction: TransferDirection;

  @Column({ type: "timestamp with time zone" })
  expires_at: Date;

  @CreateDateColumn({ type: "timestamp with time zone" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp with time zone" })
  updated_at: Date;

  @Column({ type: "enum", enum: TransferStatus, default: TransferStatus.PENDING })
  status: TransferStatus;

  @Column({ type: "varchar", length: 255, unique: true })
  idempotency_key: string;

  @Column({ type: "varchar", length: 255, unique: true })
  transaction_id: string;

  @ManyToOne(() => User, (user) => user.conditionalTransfers, { eager: true })
  @JoinColumn({ name: "user_id" })
  user: User;
}

