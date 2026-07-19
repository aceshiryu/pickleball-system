import type { Court } from "./types";
import type { SelItem } from "./store";
import { slotRate, type PeakSchedule } from "./pricing";

// Cart/selection helpers shared by the customer cart + checkout and the admin
// "add booking" flow. Pure functions, so they live in the shared lib rather
// than in a customer-only component.

// Cart contents aren't booked yet, so they price live against the current
// schedule — they'll only be frozen once the slots are held.
export function cartTotal(
  items: SelItem[],
  courts: Court[],
  schedule: PeakSchedule,
): number {
  return items.reduce((sum, it) => {
    const c = courts.find((x) => x.id === it.courtId);
    return c ? sum + slotRate(c, it.date, it.hour, schedule) : sum;
  }, 0);
}

export function groupByCourt(items: SelItem[], courts: Court[]) {
  const map = new Map<string, SelItem[]>();
  for (const it of items) {
    const arr = map.get(it.courtId) ?? [];
    arr.push(it);
    map.set(it.courtId, arr);
  }
  return Array.from(map.entries()).map(([courtId, slots]) => ({
    court: courts.find((c) => c.id === courtId)!,
    slots: slots.sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1)),
  }));
}
