import {
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

// One row per reserved hour. Availability queries filter by (date, hour) and
// join the booking for its court + status, so index the pair.
@Index(['date', 'hour'])
@Entity({ name: 'booking_slots' })
export class BookingSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.slots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  // yyyy-mm-dd; the `date` column type returns a plain 'YYYY-MM-DD' string.
  @Column({ type: 'date' })
  date: string;

  // start hour, 6..21
  @Column({ type: 'int' })
  hour: number;

  // Price charged for this hour, frozen when the booking was made. Kept on the
  // row so changing the court's rates or the facility's peak hours never
  // reprices an existing hold/booking.
  @Column({ type: 'int', default: 0 })
  rate: number;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
