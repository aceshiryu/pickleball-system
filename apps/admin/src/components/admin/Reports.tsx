"use client";

import React, { useMemo } from "react";
import { useStore } from "@shared/lib/store";
import { peso } from "@shared/lib/pricing";
import { hourLabel } from "@shared/lib/dates";
import { cancellationRate, hourDistribution, isRevenue, peakSplit } from "@shared/lib/analytics";
import { C, FONT_DISPLAY } from "@shared/lib/theme";


export default function Reports({ isMobile }: { isMobile: boolean }) {
  const { bookings, courts, bookableHours: HRS } = useStore();
  const confirmed = useMemo(() => bookings.filter(isRevenue), [bookings]);
  const totalRev = confirmed.reduce((s, b) => s + b.total, 0);
  const totalHours = confirmed.reduce((s, b) => s + b.slots.length, 0);
  const dist = hourDistribution(bookings);
  const maxHour = Math.max(1, ...Object.values(dist));
  const busiest = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  const split = peakSplit(bookings, courts);
  const peakPct = Math.round((split.peak / Math.max(1, split.peak + split.off)) * 100);
  const cancel = cancellationRate(bookings);

  const byCourt = courts.map((c) => { const rows = confirmed.filter((b) => b.courtId === c.id); return { name: c.name, value: rows.reduce((s, b) => s + b.total, 0) }; });
  const maxCourt = Math.max(1, ...byCourt.map((c) => c.value));

  const stats: [string, string][] = [["Total revenue", peso(totalRev)], ["Court-hours sold", String(totalHours)], ["Busiest hour", busiest ? hourLabel(Number(busiest[0])) : ", "], ["Cancellation rate", cancel + "%"]];
  const dashCols = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 16 }}>
        {stats.map(([l, v]) => (
          <div key={l} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginBottom: 8 }}>{l}</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: "-.01em" }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: dashCols, gap: 16, alignItems: "start", marginBottom: 16 }}>
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Revenue by court</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {byCourt.map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.slate }}>{r.name}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5 }}>{peso(r.value)}</span>
                </div>
                <div style={{ background: "#f1f5f4", borderRadius: 99 }}>
                  <div style={{ height: 12, borderRadius: 99, width: `${(r.value / maxCourt) * 100}%`, background: "linear-gradient(90deg,#22c55e,#15803d)", transformOrigin: "left", animation: "pp-grow .5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Peak vs off-peak</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ width: 150, height: 150, borderRadius: "50%", background: `conic-gradient(#16a34a 0 ${peakPct}%,#fbbf24 ${peakPct}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22 }}>{peakPct}%</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <LegRow color={C.green} title="Peak hours" sub={`${peakPct}% of hours`} />
              <LegRow color="#fbbf24" title="Off-peak" sub={`${100 - peakPct}% of hours`} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Bookings by hour of day</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 150 }}>
          {HRS.map((h) => (
            <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
              <div style={{ width: "100%", background: h >= 17 ? "#fcd34d" : "#86efac", borderRadius: "4px 4px 2px 2px", height: Math.round(((dist[h] ?? 0) / maxHour) * 120 + 4) }} />
              <div style={{ fontSize: 9.5, color: C.faint, fontWeight: 600, height: 12 }}>{h % 3 === 0 ? (h % 12 === 0 ? 12 : h % 12) : ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegRow({ color, title, sub }: { color: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 13, height: 13, borderRadius: 4, background: color }} />
      <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{title}</div><div style={{ fontSize: 12, color: C.faint }}>{sub}</div></div>
    </div>
  );
}
