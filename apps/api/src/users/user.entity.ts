import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// customer = books courts; staff = limited console; admin = full console.
export type UserRole = 'customer' | 'staff' | 'admin';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  // Customers sign in with Google and have no password.
  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  // Google's stable subject id, set on first Google sign-in. Matching on this
  // rather than email means a customer who changes their Gmail address keeps
  // the same account (and their booking history) instead of getting a new one.
  @Column({ name: 'google_sub', type: 'varchar', unique: true, nullable: true })
  googleSub: string | null;

  @Column({ type: 'varchar', default: 'customer' })
  role: UserRole;

  @Column({ default: '' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Set when the account is removed. TypeORM excludes soft-deleted rows from
  // find/query-builder reads automatically, so a removed user disappears from
  // the directory and can no longer sign in, while their bookings survive.
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
