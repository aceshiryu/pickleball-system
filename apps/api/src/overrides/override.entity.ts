import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type OverrideScope = 'date' | 'hours' | 'week';
export type OverrideReason =
  | 'maintenance'
  | 'holiday'
  | 'private_event'
  | 'other';

// Blackout / override: makes court time unbookable (holidays, maintenance,
// private events). courtId is either a court uuid or the sentinel "all".
@Entity({ name: 'overrides' })
export class Override {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  label: string;

  @Column({ type: 'varchar' })
  reason: OverrideReason;

  // "all" or a specific court id
  @Column({ name: 'court_id', type: 'varchar' })
  courtId: string;

  @Column({ type: 'varchar' })
  scope: OverrideScope;

  // yyyy-mm-dd: the day (date/hours) or any day within the week (week scope)
  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_hour', type: 'int', nullable: true })
  startHour: number | null;

  @Column({ name: 'end_hour', type: 'int', nullable: true })
  endHour: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
