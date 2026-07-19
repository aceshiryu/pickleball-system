import { Court } from '../courts/court.entity';

export interface SlotInput {
  date: string; // yyyy-mm-dd
  hour: number;
}

// Facility-wide peak hours, one-hour intervals. Configured in Settings.
export interface PeakSchedule {
  weekday: number[];
  weekend: number[];
}

export function isPeak(
  dateISO: string,
  hour: number,
  schedule: PeakSchedule,
): boolean {
  const day = new Date(dateISO + 'T00:00:00').getDay();
  const weekend = day === 0 || day === 6;
  const hours = weekend ? schedule.weekend : schedule.weekday;
  return hours.includes(hour);
}

export function slotRate(
  court: Court,
  dateISO: string,
  hour: number,
  schedule: PeakSchedule,
): number {
  return isPeak(dateISO, hour, schedule) ? court.peakRate : court.offPeakRate;
}

export function slotsTotal(
  court: Court,
  slots: SlotInput[],
  schedule: PeakSchedule,
): number {
  return slots.reduce(
    (sum, s) => sum + slotRate(court, s.date, s.hour, schedule),
    0,
  );
}
