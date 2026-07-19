import type { Booking, Court } from "./types";
import { todayISO } from "./dates";

export function isRevenue(b: Booking): boolean {
  return b.status === "confirmed" || b.status === "checked_in" || b.status === "completed";
}

// Bookings whose first slot date falls within [startISO, endISO] inclusive.
export function inDateRange(b: Booking, startISO: string, endISO: string): boolean {
  const d = b.slots[0]?.date;
  if (!d) return false;
  return d >= startISO && d <= endISO;
}

export function revenueOf(bookings: Booking[]): number {
  return bookings.filter(isRevenue).reduce((s, b) => s + b.total, 0);
}

// Splits booked hours by the rate actually charged, using each slot's frozen
// rate rather than today's schedule — so past bookings stay classified the way
// they were sold, even after the peak hours change.
export function peakSplit(
  bookings: Booking[],
  courts: Court[]
): { peak: number; off: number } {
  let peak = 0;
  let off = 0;
  for (const b of bookings.filter(isRevenue)) {
    const court = courts.find((c) => c.id === b.courtId);
    for (const s of b.slots) {
      if (court && s.rate === court.peakRate) peak += 1;
      else off += 1;
    }
  }
  return { peak, off };
}

// Distribution of confirmed booking hours across hour-of-day.
export function hourDistribution(bookings: Booking[]): Record<number, number> {
  const map: Record<number, number> = {};
  for (const b of bookings.filter(isRevenue)) {
    for (const s of b.slots) {
      map[s.hour] = (map[s.hour] ?? 0) + 1;
    }
  }
  return map;
}

export function cancellationRate(bookings: Booking[]): number {
  const relevant = bookings.filter(
    (b) => b.status === "confirmed" || b.status === "cancelled"
  );
  if (relevant.length === 0) return 0;
  const cancelled = relevant.filter((b) => b.status === "cancelled").length;
  return Math.round((cancelled / relevant.length) * 100);
}

export function isToday(b: Booking): boolean {
  return b.slots.some((s) => s.date === todayISO());
}
