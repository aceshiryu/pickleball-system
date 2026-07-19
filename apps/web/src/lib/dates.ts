export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// Monday as start of week
export function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toISO(d);
}

export function weekDays(startIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i));
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function dowShort(iso: string): string {
  return DOW[new Date(iso + "T00:00:00").getDay()];
}

export function dayNum(iso: string): number {
  return new Date(iso + "T00:00:00").getDate();
}

export function monShort(iso: string): string {
  return MON[new Date(iso + "T00:00:00").getMonth()];
}

export function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

export function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

export function hourRange(h: number): string {
  return `${hourLabel(h)} to ${hourLabel(h + 1)}`;
}

export function isPast(iso: string, hour: number): boolean {
  const now = new Date();
  const slot = new Date(iso + "T00:00:00");
  slot.setHours(hour);
  return slot.getTime() < now.getTime();
}
