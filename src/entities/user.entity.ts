import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
} from "typeorm";
import { ConditionalTransfer } from "./conditional-transfer.entity";
import * as bcrypt from "bcrypt";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  api_key: string;

  @Column()
  api_secret: string;

  @Column()
  account: string;

  @BeforeInsert()
  async hashPassword() {
    this.password = await bcrypt.hash(this.password, 10);
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  @OneToMany(
    () => ConditionalTransfer,
    (conditionalTransfer) => conditionalTransfer.user
  )
  conditionalTransfers: ConditionalTransfer[];
}
