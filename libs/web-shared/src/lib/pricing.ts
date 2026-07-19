import type { Court, Slot } from "./types";

// Fallbacks used until settings load. Real opening hours are configured in
// Court management and come from the store.
export const DEFAULT_OPEN_HOUR = 6;
export const DEFAULT_CLOSE_HOUR = 22; // exclusive: last slot starts at 21:00

// Bookable start hours for a window. closeHour is exclusive, so 0..24 = all day.
export function hourList(openHour: number, closeHour: number): number[] {
  return Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i);
}

export const HOURS: number[] = hourList(DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR);

// Facility-wide peak hours, configured in Court management. An hour listed is
// charged the court's peak rate; anything else is off-peak.
export interface PeakSchedule {
  weekday: number[];
  weekend: number[];
}

// Matches the old hardcoded rule, used until settings load.
export const DEFAULT_PEAK_SCHEDULE: PeakSchedule = {
  weekday: [17, 18, 19, 20, 21],
  weekend: HOURS,
};

export function isWeekendISO(dateISO: string): boolean {
  const day = new Date(dateISO + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

export function isPeak(
  dateISO: string,
  hour: number,
  schedule: PeakSchedule
): boolean {
  const hours = isWeekendISO(dateISO) ? schedule.weekend : schedule.weekday;
  return hours.includes(hour);
}

// Live price for a slot that is NOT booked yet. For an existing booking use the
// frozen `slot.rate` instead — its price must not move when settings change.
export function slotRate(
  court: Court,
  dateISO: string,
  hour: number,
  schedule: PeakSchedule
): number {
  return isPeak(dateISO, hour, schedule) ? court.peakRate : court.offPeakRate;
}

export function slotsTotal(
  court: Court,
  slots: Slot[],
  schedule: PeakSchedule
): number {
  return slots.reduce(
    (sum, s) => sum + slotRate(court, s.date, s.hour, schedule),
    0
  );
}

export function peso(n: number): string {
  return "₱" + n.toLocaleString("en-PH");
}
