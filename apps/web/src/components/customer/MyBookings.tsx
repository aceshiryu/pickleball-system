"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Booking, BookingStatus } from "@/lib/types";
import { hourLabel, prettyDate } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { StatusPill } from "../ui";
import BookingDetailModal from "../BookingDetailModal";
import HoldPayment from "./HoldPayment";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

function whenLabel(b: Booking): string {
  if (!b.slots.length) return `${b.hours} slots`;
  const first = b.slots[0];
  const last = b.slots[b.slots.length - 1];
  return `${prettyDate(first.date)} · ${hourLabel(first.hour)} to ${hourLabel(last.hour + 1)}`;
}
function note(b: Booking): string {
  switch (b.status) {
    case "confirmed": return "You're all set, see you on the court!";
    case "pending_approval": return b.seenByAdmin ? "An admin has opened your booking, acknowledged, not yet confirmed." : "Payment submitted, waiting for an admin to verify your receipt.";
    case "rejected": return b.note || "Payment could not be verified.";
    case "hold": return "Slots held, open this booking to upload your receipt and submit for approval before the hold expires.";
    case "cancelled": return b.note ? `Cancelled, ${b.note} Hours reopened.` : "Cancelled by admin, hours reopened.";
    default: return "";
  }
}

type Filter = "all" | BookingStatus;
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["hold", "Held"],
  ["pending_approval", "Pending"],
  ["confirmed", "Confirmed"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"],
];

export default function MyBookings({ onBook }: { onBook: () => void }) {
  const { bookings, courts, currentCustomer, refreshHolds } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [detail, setDetail] = useState<Booking | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef<Set<string>>(new Set());

  const mine = bookings.filter((b) => b.customerId === currentCustomer.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const shown = mine.filter((b) => (filter === "all" ? true : b.status === filter));

  const holds = mine.filter((b) => b.status === "hold");

  function holdSecLeft(b: Booking): number {
    if (!b.holdExpiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(b.holdExpiresAt).getTime() - now) / 1000));
  }

  // Tick once a second only while there are holds to count down.
  useEffect(() => {
    if (holds.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [holds.length]);

  // When a hold's countdown reaches zero, re-fetch so the API cancels it (the
  // slot reopens) and the card flips to "cancelled". Fire once per booking.
  useEffect(() => {
    let expired = false;
    for (const b of holds) {
      if (holdSecLeft(b) <= 0 && !firedRef.current.has(b.id)) {
        firedRef.current.add(b.id);
        expired = true;
      }
    }
    if (expired) refreshHolds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, holds]);

  return (
    <main style={{ flex: 1, width: "100%", maxWidth: 780, margin: "0 auto", padding: "22px 16px 80px" }}>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", margin: "0 0 4px" }}>My bookings</h1>
      <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 14 }}>Track approvals, payments, and upcoming sessions.</p>

      {mine.length > 0 && (
        <div style={{ display: "flex", gap: 6, background: "#eef2f0", padding: 4, borderRadius: 12, marginBottom: 16, width: "fit-content", maxWidth: "100%", overflowX: "auto" }} className="thin-scroll">
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const count = id === "all" ? mine.length : mine.filter((b) => b.status === id).length;
            return (
              <button key={id} onClick={() => setFilter(id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: FONT_DISPLAY, background: on ? "#fff" : "transparent", color: on ? C.greenD : C.muted, boxShadow: on ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>
                {label}<span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, color: "#fff", background: on ? C.green : C.faint }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {shown.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((b) => {
            const rejected = b.status === "rejected";
            const isHold = b.status === "hold";
            const secLeft = isHold ? holdSecLeft(b) : 0;
            const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
            const ss = String(secLeft % 60).padStart(2, "0");
            let cdBg = "#eff6ff", cdFg = "#1d4ed8";
            if (secLeft <= 60) { cdBg = "#fff1f2"; cdFg = "#be123c"; }
            else if (secLeft <= 180) { cdBg = "#fffbeb"; cdFg = "#b45309"; }
            return (
              <button key={b.id} onClick={() => setDetail(b)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${isHold ? cdFg + "55" : C.border}`, borderRadius: 18, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,.03)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{b.courtName}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, background: "#f1f5f4", padding: "2px 8px", borderRadius: 999, fontFamily: FONT_DISPLAY }}>{b.ref}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: C.muted, marginTop: 5 }}>{whenLabel(b)}</div>
                  </div>
                  <StatusPill status={b.status} seen={b.seenByAdmin} />
                </div>
                {isHold && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 12px", borderRadius: 11, background: cdBg, color: cdFg }}>
                    <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Hold expires in</span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{mm}:{ss}</span>
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5, color: rejected ? C.blockInk2 : C.muted, background: rejected ? C.blockBg : "#f7faf9", border: `1px solid ${rejected ? C.blockBorder : C.border2}`, borderRadius: 11, padding: "10px 12px" }}>
                  {note(b)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border3}` }}>
                  <span style={{ fontSize: 13, color: C.muted }}>{b.hours} hr{b.hours > 1 ? "s" : ""}</span>
                  <span style={{ fontSize: 12.5, color: C.green, fontWeight: 600 }}>{b.status === "hold" ? "Complete payment ›" : "View details ›"}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginLeft: "auto" }}>{peso(b.total)}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: C.offBg, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", border: "2px solid #86efac" }} />
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{mine.length === 0 ? "No bookings yet" : "Nothing here"}</div>
          <div style={{ fontSize: 14, color: C.faint, marginBottom: 18 }}>{mine.length === 0 ? "Reserve your first court to see it here." : "No bookings match this filter."}</div>
          {mine.length === 0 && <button onClick={onBook} style={{ ...primaryBtn, padding: "11px 20px", fontSize: 14, boxShadow: "none" }}>Book a court</button>}
        </div>
      )}

      <BookingDetailModal
        booking={detail}
        courts={courts}
        onClose={() => setDetail(null)}
        extra={
          detail?.status === "hold" ? (
            <HoldPayment booking={detail} onDone={() => setDetail(null)} />
          ) : undefined
        }
      />
    </main>
  );
}
