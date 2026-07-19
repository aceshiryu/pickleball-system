"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { SelItem } from "@/lib/store";
import { addDays, dowShort, hourLabel, isPast, startOfWeek, todayISO, weekDays } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { CalendarDays } from "lucide-react";
import { C, FONT_DISPLAY } from "@/lib/theme";
import MonthPicker from "./MonthPicker";

// The week-grid slot picker: court tabs, week nav, and the calendar surface.
// Shared by the customer's booking page and the admin's Add booking stepper so
// the two can't drift apart. Selection state is owned by the caller.

const keyOf = (courtId: string, date: string, hour: number) => `${courtId}#${date}#${hour}`;

type Drag = { courtId: string; date: string; startHour: number; curHour: number; mode: "add" | "remove" };

export function useIsMobile(breakpoint = 880): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const rz = () => setIsMobile(window.innerWidth < breakpoint);
    rz();
    window.addEventListener("resize", rz);
    return () => window.removeEventListener("resize", rz);
  }, [breakpoint]);
  return isMobile;
}

export default function SlotCalendar({
  selected,
  onChange,
  allowPast = false,
  aside,
}: {
  selected: SelItem[];
  onChange: (next: SelItem[]) => void;
  // Front desk only: the hour already in progress today is bookable (a walk-in
  // at 2:15 wants the 2:00 slot). Past *days* stay closed either way.
  allowPast?: boolean;
  // Rendered beside the calendar surface (the customer's cart rail).
  aside?: React.ReactNode;
}) {
  const { courts, isSlotBooked, isSlotHeld, getOverride, isPeakAt, rateAt, bookableHours: HRS } = useStore();
  const active = courts.filter((c) => c.status === "active");
  const [courtId, setCourtId] = useState(active[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [mobileDay, setMobileDay] = useState(() => todayISO());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  // Courts can arrive after first render (the query resolves later).
  useEffect(() => {
    if (!courtId && active[0]) setCourtId(active[0].id);
  }, [active, courtId]);

  const court = courts.find((c) => c.id === courtId) ?? active[0];
  const days = weekDays(weekStart);
  const thisWeek = startOfWeek(todayISO());
  const mobileDayInWeek = days.includes(mobileDay) ? mobileDay : days[0];

  // The mouseup listener is registered once, so it must not close over stale
  // state: route it through a ref that always points at the current commitDrag
  // (which reads the latest `selected` and availability).
  const commitRef = useRef<() => void>(() => undefined);
  commitRef.current = commitDrag;
  useEffect(() => {
    const up = () => commitRef.current();
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  function pastFor(date: string, hour: number) {
    if (!allowPast) return isPast(date, hour);
    return date < todayISO();
  }

  function slotState(cId: string, date: string, hour: number) {
    if (pastFor(date, hour)) return "past" as const;
    if (getOverride(cId, date, hour)) return "blocked" as const;
    // A live hold blocks the slot too, but shows as "on hold" since it may
    // reopen within 10 minutes if the holder doesn't pay.
    if (isSlotHeld(cId, date, hour)) return "held" as const;
    if (isSlotBooked(cId, date, hour)) return "taken" as const;
    return isPeakAt(date, hour) ? ("peak" as const) : ("off" as const);
  }
  const isSel = (date: string, hour: number) => selected.some((s) => s.courtId === courtId && s.date === date && s.hour === hour);

  function toggle(date: string, hour: number) {
    const exists = selected.some((s) => s.courtId === courtId && s.date === date && s.hour === hour);
    onChange(
      exists
        ? selected.filter((s) => !(s.courtId === courtId && s.date === date && s.hour === hour))
        : [...selected, { courtId, date, hour }],
    );
  }

  function onDown(date: string, hour: number) {
    const st = slotState(courtId, date, hour);
    const already = isSel(date, hour);
    if (st !== "peak" && st !== "off" && !already) return;
    setDrag({ courtId, date, startHour: hour, curHour: hour, mode: already ? "remove" : "add" });
  }
  function onEnter(date: string, hour: number) {
    const d = dragRef.current;
    if (d && d.courtId === courtId && d.date === date && d.curHour !== hour) setDrag({ ...d, curHour: hour });
  }
  function commitDrag() {
    const d = dragRef.current;
    if (!d) return;
    const lo = Math.min(d.startHour, d.curHour), hi = Math.max(d.startHour, d.curHour);
    const map = new Map(selected.map((s) => [keyOf(s.courtId, s.date, s.hour), s]));
    for (let h = lo; h <= hi; h++) {
      const st = slotState(d.courtId, d.date, h);
      const k = keyOf(d.courtId, d.date, h);
      if (d.mode === "add") { if (st === "peak" || st === "off") map.set(k, { courtId: d.courtId, date: d.date, hour: h }); }
      else map.delete(k);
    }
    onChange(Array.from(map.values()));
    setDrag(null);
  }
  function dragEff(date: string, hour: number) {
    const base = isSel(date, hour);
    const d = drag;
    if (d && d.courtId === courtId && d.date === date) {
      const lo = Math.min(d.startHour, d.curHour), hi = Math.max(d.startHour, d.curHour);
      if (hour >= lo && hour <= hi) {
        const st = slotState(courtId, date, hour);
        if (d.mode === "add" && (st === "peak" || st === "off")) return { sel: true, preview: true };
        if (d.mode === "remove" && base) return { sel: false, preview: true };
      }
    }
    return { sel: base, preview: false };
  }

  function goWeek(delta: number) { const ns = addDays(weekStart, delta * 7); setWeekStart(ns); setMobileDay(weekDays(ns)[0]); }

  if (!court) return <p style={{ color: C.muted }}>No active courts available.</p>;

  const weekLabel = `${new Date(days[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(days[6] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div>
      {/* Court tabs */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }} className="thin-scroll">
        {active.map((c) => {
          const on = c.id === courtId;
          const badge = selected.filter((s) => s.courtId === c.id).length;
          return (
            <button key={c.id} onClick={() => setCourtId(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, padding: "10px 15px", borderRadius: 14, cursor: "pointer", textAlign: "left", border: `1px solid ${on ? C.green : C.border}`, background: on ? "#f0fdf4" : "#fff", color: on ? C.greenD : C.slate, boxShadow: on ? "0 4px 12px -6px rgba(22,163,74,.5)" : "none" }}>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.72 }}>{c.surface}</span>
              </span>
              {badge > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: on ? C.green : C.faint, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11 }}>{badge}</span>}
            </button>
          );
        })}
      </div>

      {/* Week nav + legend */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => goWeek(-1)} disabled={weekStart <= thisWeek} style={navBtn(weekStart <= thisWeek)}>‹</button>
          <button onClick={() => { setWeekStart(thisWeek); setMobileDay(todayISO()); }} style={{ padding: "0 15px", height: 34, borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, border: `1px solid ${weekStart === thisWeek ? C.green : C.border}`, background: weekStart === thisWeek ? "#f0fdf4" : "#fff", color: weekStart === thisWeek ? C.greenD : C.slate }}>Today</button>
          <button onClick={() => goWeek(1)} style={navBtn(false)}>›</button>
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15, color: C.ink2 }}
          >
            <CalendarDays style={{ width: 16, height: 16, color: C.green }} />
            {weekLabel}
          </button>
          {pickerOpen && (
            <MonthPicker
              value={mobileDayInWeek}
              onSelect={(iso) => { setWeekStart(startOfWeek(iso)); setMobileDay(iso); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 12, color: C.muted }}>
          <Legend sw="#ecfdf5" bd="#a7f3d0" label="Off-peak" />
          <Legend sw="#fffbeb" bd="#fcd34d" label="Peak" />
          <Legend sw="var(--brand-primary)" bd="var(--brand-primary)" label="Selected" />
          <Legend sw="#fff1f2" bd="#fecdd3" label="Blocked" />
          <Legend sw="#f8fafc" bd="#cbd5e1" label="On hold" />
          <Legend sw="#f1f5f9" bd="#e2e8f0" label="Booked" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* CALENDAR SURFACE */}
        <div style={{ flex: 1, minWidth: 0, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
          {!isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "grid", gridTemplateColumns: "58px repeat(7,minmax(0,1fr))", gap: 4 }}>
                <div />
                {days.map((d) => {
                  const today = d === todayISO();
                  const open = HRS.reduce((n, h) => { const st = slotState(courtId, d, h); return n + (st === "peak" || st === "off" ? 1 : 0); }, 0);
                  return (
                    <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0", borderRadius: 10, background: today ? C.green : undefined, color: today ? "#fff" : C.slate }}>
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: ".03em" }}>{dowShort(d)}</span>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>{new Date(d + "T00:00:00").getDate()}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, marginTop: 1, color: today ? "rgba(255,255,255,.85)" : open > 0 ? C.faint : "#cbd5cf" }}>{open > 0 ? open + " open" : "full"}</span>
                    </div>
                  );
                })}
              </div>
              {HRS.map((h) => (
                <div key={h} style={{ display: "grid", gridTemplateColumns: "58px repeat(7,minmax(0,1fr))", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 11, fontWeight: 600, color: C.faint }}>{hourLabel(h)}</div>
                  {days.map((d) => {
                    const st = slotState(courtId, d, h);
                    const eff = dragEff(d, h);
                    const clickable = st === "peak" || st === "off";
                    const price = clickable ? rateAt(court, d, h) : 0;
                    const ov = st === "blocked" ? getOverride(courtId, d, h) : undefined;
                    return (
                      <div
                        key={d + h}
                        // Test handle: the cell is a styled div with no role or
                        // accessible name, and selection is mousedown-driven for
                        // drag. e2e addresses slots through these instead of
                        // guessing at grid position or price text.
                        data-slot={`${d}|${h}`}
                        data-slot-state={st}
                        data-slot-selected={eff.sel ? "true" : "false"}
                        onMouseDown={(e) => { e.preventDefault(); onDown(d, h); }}
                        onMouseEnter={() => onEnter(d, h)}
                        title={st === "blocked" ? ov?.label ?? "Blocked" : st === "taken" ? "Already booked" : st === "held" ? "On hold by another customer, may reopen shortly" : ""}
                        style={cellStyle(st, eff.sel, eff.preview)}
                      >
                        {st === "peak" && !eff.sel && <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.peakDot }} />}
                        {(eff.sel || clickable) ? "₱" + price : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10, marginBottom: 6 }} className="thin-scroll">
                {days.map((d) => {
                  const on = d === mobileDayInWeek;
                  return (
                    <button key={d} onClick={() => setMobileDay(d)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, width: 52, padding: "9px 0", borderRadius: 13, cursor: "pointer", border: `1px solid ${on ? C.green : C.border}`, background: on ? C.green : "#fff", color: on ? "#fff" : C.slate }}>
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{dowShort(d)}</span>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{new Date(d + "T00:00:00").getDate()}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {HRS.map((h) => {
                  const st = slotState(courtId, mobileDayInWeek, h);
                  const sel = isSel(mobileDayInWeek, h);
                  const clickable = st === "peak" || st === "off";
                  const ov = st === "blocked" ? getOverride(courtId, mobileDayInWeek, h) : undefined;
                  const tc = TAGC[st];
                  return (
                    <div key={h} data-slot={`${mobileDayInWeek}|${h}`} data-slot-state={st} data-slot-selected={sel ? "true" : "false"} onClick={() => clickable && toggle(mobileDayInWeek, h)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, border: `1px solid ${sel ? C.green : C.border2}`, background: sel ? "#f0fdf4" : "#fff", cursor: clickable ? "pointer" : "default", opacity: clickable ? 1 : st === "past" ? 0.55 : 0.85 }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, minWidth: 64 }}>{hourLabel(h)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, color: tc[0], background: tc[1], border: `1px solid ${tc[2]}` }}>{st === "blocked" ? ov?.label ?? "Blocked" : TAG[st]}</span>
                      <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{clickable ? peso(rateAt(court, mobileDayInWeek, h)) : ""}</span>
                      <span style={{ width: sel ? 24 : 0, height: 24, borderRadius: "50%", background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, overflow: "hidden" }}>{sel ? "✓" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {aside}
      </div>
    </div>
  );
}

const TAG: Record<string, string> = { peak: "Peak", off: "Off-peak", taken: "Booked", held: "On hold", blocked: "Blocked", past: "Passed" };
const TAGC: Record<string, [string, string, string]> = {
  peak: ["#b45309", "#fffbeb", "#fde68a"],
  off: ["#047857", "#ecfdf5", "#bbf7d0"],
  taken: ["#94a3b8", "#f1f5f9", "#e8edeb"],
  held: ["#64748b", "#f8fafc", "#cbd5e1"],
  blocked: ["#e11d48", "#fff1f2", "#fecdd3"],
  past: ["#cbd5e1", "#f8fafc", "#eef2f6"],
};

function navBtn(disabled: boolean): React.CSSProperties {
  return { width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: disabled ? "not-allowed" : "pointer", fontSize: 16, color: C.slate, opacity: disabled ? 0.4 : 1 };
}

function Legend({ sw, bd, label }: { sw: string; bd: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, background: sw, border: `1px solid ${bd}` }} />
      {label}
    </span>
  );
}

function cellStyle(st: string, sel: boolean, preview: boolean): React.CSSProperties {
  const base: React.CSSProperties = { height: 46, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 10, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12.5, border: "1px solid", userSelect: "none", transition: "transform .08s ease,box-shadow .12s ease,background .1s ease" };
  if (sel) return { ...base, background: C.green, color: "#fff", borderColor: C.greenD, borderLeft: "3px solid #0f5132", cursor: "pointer", boxShadow: preview ? "0 0 0 2px #bbf7d0" : "0 5px 12px -4px rgba(22,163,74,.65)" };
  if (preview) return { ...base, background: "#f8fafc", color: C.faint, borderColor: "#cbd5cf", borderLeft: "3px solid #cbd5cf", cursor: "pointer" };
  switch (st) {
    case "off": return { ...base, background: "#ecfdf5", color: "#047857", borderColor: "#bbf7d0", borderLeft: "3px solid #34d399", cursor: "pointer" };
    case "peak": return { ...base, background: "#fffbeb", color: "#b45309", borderColor: "#fde68a", borderLeft: "3px solid #f59e0b", cursor: "pointer" };
    case "taken": return { ...base, background: "#f1f5f9", color: "#cbd5e1", borderColor: "#e8edeb", cursor: "not-allowed" };
    // Held: blocked like "taken", but hatched + dashed to read as temporary.
    case "held": return { ...base, background: "#f8fafc", color: "#94a3b8", border: "1px dashed #cbd5e1", borderLeft: "3px solid #94a3b8", cursor: "not-allowed", backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(100,116,139,.09) 5px,rgba(100,116,139,.09) 10px)" };
    case "blocked": return { ...base, background: "#fff1f2", color: "#fda4af", borderColor: "#fecdd3", cursor: "not-allowed", backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(244,63,94,.07) 5px,rgba(244,63,94,.07) 10px)" };
    default: return { ...base, background: "#f8fafc", color: "#e2e8f0", borderColor: "#eef2f6", cursor: "default" };
  }
}
