import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * A long-lived credential for machine callers (the MCP server, scripts, CI).
 *
 * The key carries its owner's role, so an admin's key can do anything that
 * admin can. Only the SHA-256 hash is stored — a leaked database gives an
 * attacker nothing usable.
 */
@Entity({ name: 'api_keys' })
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human label, e.g. "MCP server (laptop)".
  @Column()
  name: string;

  // SHA-256 of the raw key. The raw value is shown exactly once, at creation.
  @Column({ name: 'key_hash', unique: true })
  keyHash: string;

  // Leading chars kept for display, e.g. "pickleball-Ab12Cd". Enough to tell
  // two keys apart in a list, far too little to reconstruct one.
  @Column()
  prefix: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Soft delete, per the project-wide rule. A revoked key must stay revoked:
  // TypeORM excludes soft-deleted rows from finds, so validate() stops
  // resolving it while the audit trail survives.
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
