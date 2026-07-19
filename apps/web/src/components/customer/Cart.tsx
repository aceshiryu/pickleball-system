"use client";

import React from "react";
import type { Court } from "@shared/lib/types";
import type { SelItem } from "@shared/lib/store";
import { useStore } from "@shared/lib/store";
import { hourRange, prettyDate } from "@shared/lib/dates";
import { peso } from "@shared/lib/pricing";
import { cartTotal, groupByCourt } from "@shared/lib/cart";
import { C, FONT_DISPLAY } from "@shared/lib/theme";

// Re-exported so existing `./Cart` imports keep working after the helpers moved
// to the shared lib.
export { cartTotal, groupByCourt };

const keyOf = (s: SelItem) => `${s.courtId}#${s.date}#${s.hour}`;

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
