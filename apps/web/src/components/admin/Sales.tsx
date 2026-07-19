"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { peso } from "@/lib/pricing";
import { isRevenue } from "@/lib/analytics";
import { addDays, startOfWeek, toISO, todayISO, weekDays } from "@/lib/dates";
import { CalendarDays } from "lucide-react";
import type { Booking } from "@/lib/types";
import MonthPicker from "../MonthPicker";
import { C, FONT_DISPLAY } from "@/lib/theme";

type Period = "week" | "month" | "year";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// The window being charted is driven by one anchor date. Week uses the whole
// date; month/year only read its month/year.
function shiftAnchor(iso: string, period: Period, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  if (period === "week") return addDays(iso, delta * 7);
  // Anchor to the 1st so month arithmetic can't overflow (Jan 31 + 1mo -> Mar 3).
  if (period === "month") return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
  return toISO(new Date(d.getFullYear() + delta, d.getMonth(), 1));
}

// Is the anchor still on the current week/month/year?
function isCurrent(iso: string, period: Period): boolean {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  if (period === "week") return startOfWeek(iso) === startOfWeek(todayISO());
  if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return d.getFullYear() === now.getFullYear();
}

export default function Sales() {
  const { bookings } = useStore();
  const [period, setPeriod] = useState<Period>("week");
  // Defaults to today, i.e. this week / this month / this year.
  const [anchor, setAnchor] = useState<string>(() => todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);

  const confirmed = useMemo(() => bookings.filter(isRevenue), [bookings]);
  const { bars, title } = useMemo(() => build(confirmed, period, anchor), [confirmed, period, anchor]);
  const total = bars.reduce((s, b) => s + b.value, 0);
  const count = bars.reduce((s, b) => s + b.count, 0);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const avg = count ? Math.round(total / count) : 0;
  const best = bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0] ?? { label: "—", value: 0, count: 0 });

  const stats: [string, string][] = [["Total", peso(total)], ["Avg / booking", peso(avg)], ["Best", best?.value ? best.label : "—"], ["Transactions", String(count)]];

  const anchorDate = new Date(anchor + "T00:00:00");
  const anchorYear = anchorDate.getFullYear();
  const anchorMonth = anchorDate.getMonth();
  const current = isCurrent(anchor, period);

  // Years you can pick: whatever the data covers, plus the current year.
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const b of confirmed) {
      const d = b.slots[0]?.date;
      if (d) set.add(Number(d.slice(0, 4)));
    }
    return [...set].sort((a, z) => z - a);
  }, [confirmed]);

  const weekLabel = (() => {
    const days = weekDays(startOfWeek(anchor));
    const f = (iso: string, withYear = false) =>
      new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
    return `${f(days[0])} to ${f(days[6], true)}`;
  })();

  const resetLabel = period === "week" ? "This week" : period === "month" ? "This month" : "This year";

  function setPeriodKeepingToday(p: Period) {
    setPeriod(p);
    setPickerOpen(false);
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {/* Period */}
        <div style={{ display: "flex", gap: 6, background: "#eef2f0", padding: 4, borderRadius: 12, width: "fit-content" }}>
          {(["week", "month", "year"] as Period[]).map((p) => {
            const on = period === p;
            return (
              <button key={p} onClick={() => setPeriodKeepingToday(p)} style={{ padding: "8px 18px", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: FONT_DISPLAY, textTransform: "capitalize", background: on ? "#fff" : "transparent", color: on ? C.greenD : C.muted, boxShadow: on ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>{p}</button>
            );
          })}
        </div>

        {/* Which week / month / year */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button onClick={() => setAnchor(shiftAnchor(anchor, period, -1))} style={navBtn} title="Previous">‹</button>

          {period === "week" && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setPickerOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.ink2 }}>
                <CalendarDays style={{ width: 15, height: 15, color: C.green }} />
                {weekLabel}
              </button>
              {pickerOpen && (
                <MonthPicker
                  value={anchor}
                  allowPast
                  align="right"
                  onSelect={(iso) => { setAnchor(iso); setPickerOpen(false); }}
                  onClose={() => setPickerOpen(false)}
                />
              )}
            </div>
          )}

          {period === "month" && (
            <>
              <select value={anchorMonth} onChange={(e) => setAnchor(toISO(new Date(anchorYear, Number(e.target.value), 1)))} style={sel}>
                {MON_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={anchorYear} onChange={(e) => setAnchor(toISO(new Date(Number(e.target.value), anchorMonth, 1)))} style={sel}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}

          {period === "year" && (
            <select value={anchorYear} onChange={(e) => setAnchor(toISO(new Date(Number(e.target.value), 0, 1)))} style={sel}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          <button onClick={() => setAnchor(shiftAnchor(anchor, period, 1))} style={navBtn} title="Next">›</button>

          <button
            onClick={() => setAnchor(todayISO())}
            disabled={current}
            title={current ? `Already showing ${resetLabel.toLowerCase()}` : `Jump to ${resetLabel.toLowerCase()}`}
            style={{ padding: "0 14px", height: 34, borderRadius: 10, cursor: current ? "default" : "pointer", fontWeight: 600, fontSize: 13, border: `1px solid ${current ? C.green : C.border}`, background: current ? "#f0fdf4" : "#fff", color: current ? C.greenD : C.slate }}
          >
            {resetLabel}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
        {stats.map(([l, v]) => (
          <div key={l} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 10 }}>{l}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-.02em" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 20 }}>{title}</div>
        {total === 0 && (
          <div style={{ fontSize: 13, color: C.faint, marginTop: -12, marginBottom: 16 }}>No revenue recorded in this period.</div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 230, paddingBottom: 26, position: "relative" }}>
          {bars.map((b, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: "#475569" }}>{b.value > 0 ? "₱" + (b.value / 1000).toFixed(b.value < 10000 ? 1 : 0) + "k" : ""}</div>
              <div style={{ width: "100%", maxWidth: 52, height: Math.round((b.value / max) * 160), borderRadius: "8px 8px 3px 3px", background: "linear-gradient(180deg,#22c55e,#15803d)", transformOrigin: "bottom", animation: "pp-grow .5s cubic-bezier(.2,.8,.2,1)" }} />
              <div style={{ position: "absolute", bottom: 0, fontSize: 11.5, color: C.faint, fontWeight: 600 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 16, color: C.slate };
const sel: React.CSSProperties = { height: 34, padding: "0 10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5, color: C.ink2 };

function build(
  confirmed: Booking[],
  period: Period,
  anchor: string,
): { bars: { label: string; value: number; count: number }[]; title: string } {
  const d = new Date(anchor + "T00:00:00");
  const year = d.getFullYear();
  const sum = (rows: Booking[]) => rows.reduce((s, b) => s + b.total, 0);

  if (period === "week") {
    const days = weekDays(startOfWeek(anchor));
    const label = isCurrent(anchor, "week")
      ? "this week"
      : `${new Date(days[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(days[6] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return {
      title: `Revenue by day, ${label}`,
      bars: days.map((day, i) => {
        const inDay = confirmed.filter((b) => b.slots[0]?.date === day);
        return { label: DOW[i], value: sum(inDay), count: inDay.length };
      }),
    };
  }

  if (period === "month") {
    const m = d.getMonth();
    return {
      title: `Revenue by week, ${MON[m]} ${year}`,
      bars: [0, 1, 2, 3, 4].map((w) => {
        const inW = confirmed.filter((b) => {
          const day = b.slots[0]?.date;
          if (!day) return false;
          const dt = new Date(day + "T00:00:00");
          return dt.getMonth() === m && dt.getFullYear() === year && Math.floor((dt.getDate() - 1) / 7) === w;
        });
        return { label: "W" + (w + 1), value: sum(inW), count: inW.length };
      }),
    };
  }

  return {
    title: `Revenue by month, ${year}`,
    bars: MON.map((label, m) => {
      const inM = confirmed.filter((b) => {
        const day = b.slots[0]?.date;
        if (!day) return false;
        const dt = new Date(day + "T00:00:00");
        return dt.getFullYear() === year && dt.getMonth() === m;
      });
      return { label, value: sum(inM), count: inM.length };
    }),
  };
}
