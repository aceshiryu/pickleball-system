"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@shared/lib/store";
import type { SelItem } from "@shared/lib/store";
import { peso } from "@shared/lib/pricing";
import { C, FONT_DISPLAY, primaryBtn } from "@shared/lib/theme";
import SlotCalendar, { useIsMobile } from "@shared/components/SlotCalendar";
import { CartGroups, cartTotal, groupByCourt } from "./Cart";
import Checkout from "./Checkout";

const keyOf = (courtId: string, date: string, hour: number) => `${courtId}#${date}#${hour}`;

export default function BookingCalendar() {
  const { courts, peakSchedule } = useStore();
  const [selected, setSelected] = useState<SelItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const total = useMemo(() => cartTotal(selected, courts, peakSchedule), [selected, courts, peakSchedule]);
  const nCourts = groupByCourt(selected, courts).length;

  function removeItem(it: SelItem) {
    setSelected((prev) => prev.filter((s) => keyOf(s.courtId, s.date, s.hour) !== keyOf(it.courtId, it.date, it.hour)));
  }

  const cartRail = (
    <aside style={{ width: 320, flexShrink: 0, position: "sticky", top: 88, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Your session</span>
        {selected.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: C.green, background: C.offBg, padding: "3px 9px", borderRadius: 999 }}>{selected.length} hr{selected.length === 1 ? "" : "s"}</span>}
      </div>
      {selected.length > 0 ? (
        <>
          <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto", margin: "-4px -4px 14px", padding: 4 }} className="thin-scroll">
            <CartGroups items={selected} courts={courts} onRemove={removeItem} />
          </div>
          <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 24, letterSpacing: "-.01em" }}>{peso(total)}</span>
          </div>
          <button onClick={() => setCheckoutOpen(true)} style={{ ...primaryBtn, width: "100%", padding: 14, fontSize: 15, borderRadius: 14 }}>Continue to payment</button>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "26px 10px" }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: "#f1f5f4", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px dashed #cbd5cf" }} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#475569", marginBottom: 4 }}>No slots yet</div>
          <div style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.5 }}>Tap green or amber cells on the calendar to add court hours.</div>
        </div>
      )}
    </aside>
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", margin: "0 0 4px" }}>Book a court</h1>
          <p style={{ margin: 0, color: C.muted, fontSize: 14 }}>Tap a slot, or drag down a column, to grab several hours at once. Selections span courts.</p>
        </div>
      </div>

      <SlotCalendar
        selected={selected}
        onChange={setSelected}
        aside={!isMobile ? cartRail : undefined}
      />

      {/* Mobile floating bar */}
      {isMobile && selected.length > 0 && !sheetOpen && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45, padding: "12px 16px", background: "linear-gradient(to top,#f4f6f5 60%,rgba(244,246,245,0))" }}>
          <button onClick={() => setSheetOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", border: "none", borderRadius: 16, background: C.greenGrad, color: "#fff", cursor: "pointer", boxShadow: "0 12px 26px -10px rgba(22,163,74,.9)" }}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{selected.length} hr{selected.length === 1 ? "" : "s"} · {peso(total)}</span>
              <span style={{ fontSize: 11.5, opacity: 0.85 }}>Across {nCourts} court{nCourts === 1 ? "" : "s"}</span>
            </span>
            <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>Review ›</span>
          </button>
        </div>
      )}

      {/* Mobile sheet */}
      {sheetOpen && (
        <div onClick={() => setSheetOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,23,42,.4)", display: "flex", alignItems: "flex-end" }}>
          <div className="pp-sheet" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "80vh", overflowY: "auto", background: "#fff", borderRadius: "22px 22px 0 0", padding: 20 }}>
            <div style={{ width: 38, height: 4, borderRadius: 99, background: "#e2e8e4", margin: "0 auto 16px" }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 14 }}>Your session</div>
            <div style={{ marginBottom: 16 }}><CartGroups items={selected} courts={courts} onRemove={removeItem} /></div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: `1px dashed ${C.border}`, paddingTop: 14, marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>{peso(total)}</span>
            </div>
            <button onClick={() => { setSheetOpen(false); setCheckoutOpen(true); }} style={{ ...primaryBtn, width: "100%", padding: 15, fontSize: 15, borderRadius: 14 }}>Continue to payment</button>
          </div>
        </div>
      )}

      <Checkout open={checkoutOpen} onClose={() => setCheckoutOpen(false)} items={selected} courts={courts} total={total} onDone={() => { setCheckoutOpen(false); setSelected([]); }} />
    </div>
  );
}
