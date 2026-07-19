"use client";

import React from "react";
import type { Court } from "@/lib/types";
import type { SelItem } from "@/lib/store";
import { useStore } from "@/lib/store";
import { hourRange, prettyDate } from "@/lib/dates";
import { peso, slotRate, type PeakSchedule } from "@/lib/pricing";
import { C, FONT_DISPLAY } from "@/lib/theme";

const keyOf = (s: SelItem) => `${s.courtId}#${s.date}#${s.hour}`;

// Cart contents aren't booked yet, so they price live against the current
// schedule — they'll only be frozen once the slots are held.
export function cartTotal(
  items: SelItem[],
  courts: Court[],
  schedule: PeakSchedule
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

export function CartGroups({
  items,
  courts,
  onRemove,
}: {
  items: SelItem[];
  courts: Court[];
  onRemove: (it: SelItem) => void;
}) {
  const { isPeakAt, rateAt } = useStore();
  const groups = groupByCourt(items, courts);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map((g) => (
        <div key={g.court.id}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 7 }}>
            {g.court.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.slots.map((s) => {
              const peak = isPeakAt(s.date, s.hour);
              return (
                <div key={keyOf(s)} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>{prettyDate(s.date)}</div>
                    <div style={{ fontSize: 12, color: C.muted2 }}>
                      {hourRange(s.hour)} · {peak ? "Peak" : "Off-peak"}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13 }}>
                    {peso(rateAt(g.court, s.date, s.hour))}
                  </div>
                  <button
                    onClick={() => onRemove(s)}
                    style={{ width: 22, height: 22, borderRadius: 7, border: "none", background: C.border2, color: C.faint, cursor: "pointer", fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
