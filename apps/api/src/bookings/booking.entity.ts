import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';
import { BookingSlot } from './booking-slot.entity';

export type BookingStatus =
  | 'hold'
  | 'pending_approval'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'no_show'
  | 'rejected'
  | 'cancelled';

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ref: string;

  // Optional: a walk-in booked at the counter may have no account at all. The
  // contact fields below are always populated, so a booking is never anonymous
  // even when it isn't linked to a customer.
  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true, nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  // Who to contact about this booking. Auto-filled from the signed-in
  // customer's profile online; typed by the front desk for a walk-in.
  @Column({ name: 'contact_name', type: 'varchar', default: '' })
  contactName: string;

  @Column({ name: 'contact_phone', type: 'varchar', default: '' })
  contactPhone: string;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'court_id' })
  courtId: string;

  @ManyToOne(() => Court, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @OneToMany(() => BookingSlot, (slot) => slot.booking, {
    cascade: true,
    eager: true,
  })
  slots: BookingSlot[];

  @Column({ type: 'int' })
  hours: number;

  @Column({ type: 'int' })
  total: number;

  @Column({ name: 'proof_file_name', type: 'varchar', nullable: true })
  proofFileName: string | null;

  // The uploaded receipt itself, as a data: URL. Held on the row because the
  // system has no object storage yet. Deliberately NOT included in list
  // payloads (see the serializer) — fetched on demand via GET /bookings/:id/proof
  // so /bookings and /bookings/mine stay lean.
  @Column({ name: 'proof_image', type: 'text', nullable: true })
  proofImage: string | null;

  // Supabase Storage path for the receipt. Nulled when the review concludes
  // (approve/reject) — proofFileName survives, so the UI can still say a
  // receipt WAS recorded even though the image is gone.
  @Column({ name: 'proof_path', type: 'varchar', nullable: true })
  proofPath: string | null;

  @Column({ type: 'varchar' })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Captured by the admin at approval: which method the payment actually
  // arrived on and its reference/transaction number, so a confirmed booking is
  // auditable against the facility's payment account.
  @Column({ name: 'payment_method', type: 'varchar', nullable: true })
  paymentMethod: string | null;

  @Column({ name: 'payment_reference', type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ name: 'hold_expires_at', type: 'timestamptz', nullable: true })
  holdExpiresAt: Date | null;

  @Column({ name: 'seen_by_admin', type: 'boolean', default: false })
  seenByAdmin: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
