import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CourtStatus = 'active' | 'maintenance';

@Entity({ name: 'courts' })
export class Court {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  surface: string;

  @Column({ name: 'peak_rate', type: 'int' })
  peakRate: number;

  @Column({ name: 'off_peak_rate', type: 'int' })
  offPeakRate: number;

  @Column({ type: 'varchar', default: 'active' })
  status: CourtStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
