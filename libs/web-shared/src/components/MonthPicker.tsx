"use client";

import React, { useState } from "react";
import { toISO, todayISO } from "../lib/dates";
import { C, FONT_DISPLAY } from "../lib/theme";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function MonthPicker({
  value,
  onSelect,
  onClose,
  allowPast = false,
  align = "left",
}: {
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  allowPast?: boolean;
  align?: "left" | "right";
}) {
  const init = new Date(value + "T00:00:00");
  const [y, setY] = useState(init.getFullYear());
  const [m, setM] = useState(init.getMonth());
  const today = todayISO();
  const nowYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => nowYear + i);
  if (!years.includes(y)) years.unshift(y);

  const first = new Date(y, m, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function step(delta: number) {
    let nm = m + delta, ny = y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setM(nm); setY(ny);
  }

  const sel: React.CSSProperties = { padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 9, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, background: "#fff", color: C.ink2, cursor: "pointer" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
      <div
        style={{
          position: "absolute",
          zIndex: 61,
          top: 42,
          left: align === "left" ? 0 : undefined,
          right: align === "right" ? 0 : undefined,
          width: 288,
          background: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: "0 20px 50px -18px rgba(2,20,10,.35)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button onClick={() => step(-1)} style={arrow}>‹</button>
          <select value={m} onChange={(e) => setM(Number(e.target.value))} style={{ ...sel, flex: 1 }}>
            {MONTHS.map((mo, i) => <option key={mo} value={i}>{mo}</option>)}
          </select>
          <select value={y} onChange={(e) => setY(Number(e.target.value))} style={sel}>
            {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
          <button onClick={() => step(1)} style={arrow}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
          {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: C.faint, padding: "2px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const iso = toISO(new Date(y, m, d));
            const isToday = iso === today;
            const isSel = iso === value;
            const disabled = !allowPast && iso < today;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => onSelect(iso)}
                style={{
                  height: 34,
                  borderRadius: 9,
                  border: isToday && !isSel ? `1px solid ${C.green}` : "1px solid transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  fontSize: 13,
                  background: isSel ? C.green : "transparent",
                  color: isSel ? "#fff" : disabled ? "#cbd5cf" : C.slate,
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

const arrow: React.CSSProperties = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 15, color: C.slate, flexShrink: 0 };
