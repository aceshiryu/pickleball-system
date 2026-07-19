import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

// White-label branding — a single row (id = 1). Recolors the whole system.
@Entity({ name: 'settings' })
export class Settings {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ name: 'app_name', default: 'AfterHours' })
  appName: string;

  @Column({ default: '#6B2B2B' })
  primary: string;

  // Always rendered behind white text (buttons, step badges), so it has to stay
  // dark enough to carry it — #6E7275 is 4.85:1. Never set this to white.
  @Column({ default: '#6E7275' })
  secondary: string;

  // Square logo held inline as a data: URL. Kept in the row because the system
  // has no object storage yet — see the size cap in UpdateSettingsDto. Null
  // falls back to the built-in mark.
  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  // Facility opening hours. A slot at hour h covers h:00-(h+1):00, so bookable
  // start hours run openHour..closeHour-1. Open all day = 0 to 24.
  @Column({ name: 'open_hour', type: 'int', default: 6 })
  openHour: number;

  @Column({ name: 'close_hour', type: 'int', default: 22 })
  closeHour: number;

  // Facility-wide peak schedule: an hour listed here bills at the court's peak
  // rate, anything else off-peak. One-hour intervals, 0-23. Defaults reproduce
  // the old hardcoded rule (weekdays peak from 17:00, weekends peak all day).
  @Column({
    name: 'peak_hours_weekday',
    type: 'int',
    array: true,
    default: () => `'{17,18,19,20,21}'`,
  })
  peakHoursWeekday: number[];

  @Column({
    name: 'peak_hours_weekend',
    type: 'int',
    array: true,
    default: () => `'{6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21}'`,
  })
  peakHoursWeekend: number[];

  // Payment methods this facility accepts, as free-text labels ('GCash',
  // 'Maya', 'BPI transfer'). Customers pick one at checkout and admins record
  // one on approval, so the list is facility config rather than a fixed enum —
  // every facility takes a different set. 'Cash' is seeded as a sane default.
  @Column({
    name: 'payment_methods',
    type: 'text',
    array: true,
    default: () => `'{Cash}'`,
  })
  paymentMethods: string[];

  // Key of the facility's chosen font pairing (see web lib/fonts.ts).
  @Column({ name: 'font_family', type: 'varchar', default: 'space-grotesk' })
  fontFamily: string;

  // Set when the admin finishes onboarding. Until then the console is locked
  // and most write APIs are refused (see OnboardingGuard).
  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
