"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Booking, BookingStatus } from "@/lib/types";
import { hourLabel, prettyDate } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { Avatar, StatusPill } from "../ui";
import { useConfirm } from "../Confirm";
import BookingDetailModal from "../BookingDetailModal";
import AddBooking from "./AddBooking";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

type Filter = "all" | BookingStatus;
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["pending_approval", "Pending"],
  ["confirmed", "Confirmed"],
  ["checked_in", "Checked in"],
  ["completed", "Completed"],
  ["no_show", "No-show"],
  ["hold", "Holding"],
  ["rejected", "Rejected"],
  ["cancelled", "Cancelled"],
];

const COL = "0.8fr 1.4fr 1.1fr 1.3fr 0.6fr 0.9fr 1fr";

export default function Bookings({ isMobile }: { isMobile: boolean }) {
  const { bookings, courts, checkInBooking, completeBooking, markNoShow } = useStore();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("all");
  const [courtId, setCourtId] = useState("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Booking | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => {
    return bookings
      .filter((b) => (filter === "all" ? true : b.status === filter))
      .filter((b) => (courtId === "all" ? true : b.courtId === courtId))
      .filter((b) => !q || b.customerName.toLowerCase().includes(q.toLowerCase()) || b.ref.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        const da = a.slots[0]?.date ?? "", db = b.slots[0]?.date ?? "";
        return da === db ? (a.slots[0]?.hour ?? 0) - (b.slots[0]?.hour ?? 0) : da < db ? 1 : -1;
      });
  }, [bookings, filter, courtId, q]);

  const when = (b: Booking) => (b.slots[0] ? `${prettyDate(b.slots[0].date)}, ${hourLabel(b.slots[0].hour)}` : "");
  const detailLive = detail ? bookings.find((b) => b.id === detail.id) ?? detail : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Bookings</div>
          <div style={{ fontSize: 13, color: C.muted }}>Take a walk-in booking, or manage what&apos;s already booked.</div>
        </div>
        <button onClick={() => setAddOpen(true)} style={{ ...primaryBtn, marginLeft: "auto", padding: "11px 18px", fontSize: 14, boxShadow: "none" }}>
          + Add booking
        </button>
      </div>

      <AddBooking open={addOpen} onClose={() => setAddOpen(false)} />

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, background: "#eef2f0", padding: 4, borderRadius: 12, overflowX: "auto" }} className="thin-scroll">
          {FILTERS.map(([id, label]) => {
            const on = filter === id;
            const count = id === "all" ? bookings.length : bookings.filter((b) => b.status === id).length;
            return (
              <button key={id} onClick={() => setFilter(id)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: FONT_DISPLAY, background: on ? "#fff" : "transparent", color: on ? C.greenD : C.muted, boxShadow: on ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>
                {label}<span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 999, color: "#fff", background: on ? C.green : C.faint }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginLeft: isMobile ? 0 : "auto", flex: isMobile ? "1 1 100%" : undefined }}>
          <select value={courtId} onChange={(e) => setCourtId(e.target.value)} style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, background: "#fff", color: C.slate, cursor: "pointer" }}>
            <option value="all">All courts</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 160, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 11, padding: "9px 12px" }}>
            <span style={{ color: C.faint }}>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ref" style={{ border: "none", outline: "none", flex: 1, fontFamily: FONT_DISPLAY, fontSize: 13.5, background: "transparent", color: C.slate }} />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>No bookings found</div>
          <div style={{ fontSize: 13.5, color: C.faint, marginTop: 5 }}>Try a different filter or search.</div>
        </div>
      ) : isMobile ? (
        /* MOBILE: cards */
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((b) => (
            <button key={b.id} onClick={() => setDetail(b)} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={b.customerName} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink2 }}>{b.customerName}</div>
                  <div style={{ fontSize: 12, color: C.faint }}>{b.ref} · {b.courtName}</div>
                </div>
                <StatusPill status={b.status} seen={b.seenByAdmin} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border3}` }}>
                <span style={{ fontSize: 13, color: C.muted }}>{when(b)} · {b.hours} hr{b.hours > 1 ? "s" : ""}</span>
                <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{peso(b.total)}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* DESKTOP: table */
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, overflowX: "auto", boxShadow: "0 1px 2px rgba(16,24,40,.03)" }} className="thin-scroll">
          <div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: COL, gap: 12, padding: "12px 18px", background: "#f7faf9", borderBottom: `1px solid ${C.border2}`, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint }}>
              <span>Ref</span><span>Player</span><span>Court</span><span>Date &amp; time</span><span>Hours</span><span style={{ textAlign: "right" }}>Total</span><span>Status</span>
            </div>
            {rows.map((b) => (
              <div key={b.id} onClick={() => setDetail(b)} style={{ display: "grid", gridTemplateColumns: COL, gap: 12, padding: "13px 18px", borderBottom: `1px solid ${C.bg}`, alignItems: "center", cursor: "pointer" }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12.5, color: C.muted }}>{b.ref}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <Avatar name={b.customerName} size={30} />
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.customerName}</span>
                </div>
                <span style={{ fontSize: 13, color: C.slate }}>{b.courtName}</span>
                <span style={{ fontSize: 13, color: C.slate }}>{when(b)}</span>
                <span style={{ fontSize: 13, color: C.slate }}>{b.hours}</span>
                <span style={{ textAlign: "right", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{peso(b.total)}</span>
                <span><StatusPill status={b.status} seen={b.seenByAdmin} /></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <BookingDetailModal
        booking={detailLive}
        courts={courts}
        onClose={() => setDetail(null)}
        footer={detailLive && (detailLive.status === "confirmed" || detailLive.status === "checked_in") ? (
          detailLive.status === "confirmed" ? (
            <>
              <button onClick={async () => { if (await confirm({ title: "Mark as no-show?", message: `${detailLive.customerName} did not arrive. Their court time will be released.`, confirmLabel: "Mark no-show", danger: true })) markNoShow(detailLive.id); }} style={{ padding: "13px 16px", border: `1px solid ${C.peakBorder}`, borderRadius: 12, background: "#fff", color: C.peakInk, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>No-show</button>
              <button onClick={async () => { if (await confirm({ title: "Check in player?", message: `Mark ${detailLive.customerName} as checked in.`, confirmLabel: "Check in" })) checkInBooking(detailLive.id); }} style={{ flex: 1, padding: 13, border: "none", borderRadius: 12, background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Check in player</button>
            </>
          ) : (
            <button onClick={async () => { if (await confirm({ title: "Complete session?", message: `End ${detailLive.customerName}'s session and free the court.`, confirmLabel: "Complete" })) completeBooking(detailLive.id); }} style={{ flex: 1, padding: 13, border: "none", borderRadius: 12, background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Complete session</button>
          )
        ) : undefined}
      />
    </div>
  );
}
