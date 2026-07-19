import type { Court, Override } from "./types";
import { addDays, startOfWeek, todayISO } from "./dates";

export const REASON_LABEL: Record<Override["reason"], string> = {
  maintenance: "Maintenance",
  holiday: "Holiday",
  private_event: "Private event",
  other: "Blocked",
};

export const REASON_COLOR: Record<Override["reason"], string> = {
  maintenance: "bg-amber-100 text-amber-700 border-amber-200",
  holiday: "bg-rose-100 text-rose-700 border-rose-200",
  private_event: "bg-violet-100 text-violet-700 border-violet-200",
  other: "bg-slate-200 text-slate-600 border-slate-300",
};

export function overrideBlocks(
  o: Override,
  courtId: string,
  date: string,
  hour: number
): boolean {
  if (o.courtId !== "all" && o.courtId !== courtId) return false;
  if (o.scope === "date") return date === o.date;
  if (o.scope === "hours") {
    return (
      date === o.date &&
      hour >= (o.startHour ?? 0) &&
      hour < (o.endHour ?? 24)
    );
  }
  // week
  const ws = startOfWeek(o.date);
  return date >= ws && date <= addDays(ws, 6);
}

export function findOverride(
  overrides: Override[],
  courtId: string,
  date: string,
  hour: number
): Override | undefined {
  return overrides.find((o) => overrideBlocks(o, courtId, date, hour));
}

export function seedOverrides(courts: Court[]): Override[] {
  const list: Override[] = [];
  // A holiday next week (all courts, full day)
  list.push({
    id: "o1",
    label: "Independence Day (facility closed)",
    reason: "holiday",
    courtId: "all",
    scope: "date",
    date: addDays(todayISO(), 9),
  });
  // Morning maintenance block on Court 1, a few days out
  if (courts[0]) {
    list.push({
      id: "o2",
      label: "Resurfacing, morning",
      reason: "maintenance",
      courtId: courts[0].id,
      scope: "hours",
      date: addDays(todayISO(), 4),
      startHour: 6,
      endHour: 12,
    });
  }
  return list;
}
