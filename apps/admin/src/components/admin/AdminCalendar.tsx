"use client";

import React, { useState } from "react";
import { useStore } from "@shared/lib/store";
import type { Booking, BookingStatus } from "@shared/lib/types";
import { addDays, dowShort, hourLabel, startOfWeek, todayISO, weekDays } from "@shared/lib/dates";
import { CalendarDays } from "lucide-react";
import { C, FONT_DISPLAY } from "@shared/lib/theme";
import { useConfirm } from "@shared/components/Confirm";
import BookingDetailModal from "@shared/components/BookingDetailModal";
import MonthPicker from "@shared/components/MonthPicker";

// Everything that actually occupies a slot — mirrors OCCUPYING in the API's
// bookings service. Without hold/checked_in the calendar would show a slot as
// "Open" that nobody can actually book.
const OCCUPYING: BookingStatus[] = ["hold", "pending_approval", "confirmed", "checked_in"];

type CellState = "confirmed" | "checked_in" | "pending" | "held" | "blocked" | "maint" | "open";

const STATE_OF: Record<string, CellState> = {
  confirmed: "confirmed",
  checked_in: "checked_in",
  pending_approval: "pending",
  hold: "held",
};

export default function AdminCalendar() {
  const { courts, bookings, getOverride, cancelBooking, bookableHours: HRS } = useStore();
  const confirm = useConfirm();
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [detail, setDetail] = useState<Booking | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const court = courts.find((c) => c.id === courtId);
  const days = weekDays(weekStart);
  const weekLabel = `${new Date(days[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(days[6] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  function bookingAt(date: string, hour: number) {
    return bookings.find(
      (b) =>
        b.courtId === courtId &&
        OCCUPYING.includes(b.status) &&
        b.slots.some((s) => s.date === date && s.hour === hour),
    );
  }

  // Keep the open modal in step with polling (e.g. a hold expiring).
  const detailLive = detail ? bookings.find((b) => b.id === detail.id) ?? detail : null;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {courts.map((c) => {
            const on = c.id === courtId;
            return (
              <button key={c.id} onClick={() => setCourtId(c.id)} style={{ flexShrink: 0, padding: "9px 15px", borderRadius: 12, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5, border: `1px solid ${on ? C.green : C.border}`, background: on ? C.dark : "#fff", color: on ? "#fff" : C.slate }}>
                {c.name}{c.status === "maintenance" && <span style={{ marginLeft: 8, fontSize: 10, background: C.peakBg, color: C.peakInk, padding: "1px 6px", borderRadius: 999 }}>Maintenance</span>}
              </button>
            );
          })}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}>‹</button>
          <button onClick={() => setWeekStart(startOfWeek(todayISO()))} style={{ padding: "0 15px", height: 34, borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, border: `1px solid ${C.border}`, background: "#fff", color: C.slate }}>Today</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}>›</button>
          <div style={{ position: "relative", marginLeft: 6 }}>
            <button onClick={() => setPickerOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.ink2 }}>
              <CalendarDays style={{ width: 15, height: 15, color: C.green }} />
              {weekLabel}
            </button>
            {pickerOpen && (
              <MonthPicker value={days[0]} allowPast align="right" onSelect={(iso) => { setWeekStart(startOfWeek(iso)); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14, fontSize: 12, color: C.muted }}>
        <Leg sw="#ecfdf5" bd="#a7f3d0" t="Confirmed" />
        <Leg sw="#eff6ff" bd="#bfdbfe" t="Checked in" />
        <Leg sw="#fffbeb" bd="#fcd34d" t="Pending" />
        <Leg sw="#f8fafc" bd="#cbd5e1" t="On hold" />
        <Leg sw="#fff1f2" bd="#fecdd3" t="Blocked" />
        <Leg sw="#fff" bd={C.border} t="Open" />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: "0 1px 2px rgba(16,24,40,.03)", overflowX: "auto" }}>
        <div style={{ minWidth: 760, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7,minmax(0,1fr))", gap: 4 }}>
            <div />
            {days.map((d) => {
              const today = d === todayISO();
              return (
                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "5px 0", borderRadius: 9, background: today ? C.green : undefined, color: today ? "#fff" : C.slate }}>
                  <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>{dowShort(d)}</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{new Date(d + "T00:00:00").getDate()}</span>
                </div>
              );
            })}
          </div>
          {HRS.map((h) => (
            <div key={h} style={{ display: "grid", gridTemplateColumns: "52px repeat(7,minmax(0,1fr))", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, fontSize: 11, fontWeight: 600, color: C.faint }}>{hourLabel(h)}</div>
              {days.map((d) => {
                const ov = getOverride(courtId, d, h);
                const maint = court?.status === "maintenance";
                const b = bookingAt(d, h);
                const st: CellState = maint ? "maint" : ov ? "blocked" : b ? STATE_OF[b.status] ?? "open" : "open";
                const who = b?.customerName ?? "";
                return (
                  <div
                    key={d + h}
                    style={cell(st)}
                    title={ov ? ov.label : b ? `${who} · ${b.ref}` : ""}
                    onClick={() => b && !ov && !maint && setDetail(b)}
                  >
                    {ov ? "⃠" : who ? <Name>{who}</Name> : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Same booking modal as Bookings/Approvals — full slot breakdown, frozen
          prices, proof and payment verification. */}
      <BookingDetailModal
        booking={detailLive}
        courts={courts}
        onClose={() => setDetail(null)}
        footer={detailLive ? (
          <>
            <button onClick={() => setDetail(null)} style={{ flex: 1, padding: 13, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Close</button>
            <button
              onClick={async () => {
                if (await confirm({ title: "Cancel this booking?", message: `Cancel ${detailLive.customerName}'s booking and reopen the hours for others.`, confirmLabel: "Cancel booking", danger: true })) {
                  cancelBooking(detailLive.id, "Cancelled by admin");
                  setDetail(null);
                }
              }}
              style={{ flex: 1, padding: 13, border: `1px solid ${C.blockBorder}`, borderRadius: 12, background: "#fff", color: C.blockInk2, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
            >
              Cancel &amp; reopen
            </button>
          </>
        ) : undefined}
      />
    </div>
  );
}

// Full name, wrapped to at most two lines so a long one can't blow out the row.
function Name({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        lineHeight: 1.2,
        wordBreak: "break-word",
        textAlign: "center",
      }}
    >
      {children}
    </span>
  );
}

const navBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", fontSize: 16, color: C.slate };

const cell = (st: CellState): React.CSSProperties => {
  const base: React.CSSProperties = { minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 9, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10.5, border: "1px solid", padding: "4px 5px", overflow: "hidden" };
  switch (st) {
    case "confirmed": return { ...base, background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0", cursor: "pointer" };
    case "checked_in": return { ...base, background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe", cursor: "pointer" };
    case "pending": return { ...base, background: "#fffbeb", color: "#b45309", borderColor: "#fde68a", cursor: "pointer" };
    // Held: hatched + dashed to read as temporary, matching the customer calendar.
    case "held": return { ...base, background: "#f8fafc", color: "#64748b", border: "1px dashed #cbd5e1", cursor: "pointer", backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(100,116,139,.09) 5px,rgba(100,116,139,.09) 10px)" };
    case "blocked": return { ...base, background: "#fff1f2", color: "#fda4af", borderColor: "#fecdd3", cursor: "not-allowed", backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 5px,rgba(244,63,94,.07) 5px,rgba(244,63,94,.07) 10px)" };
    case "maint": return { ...base, background: "#f8fafc", color: "#cbd5cf", borderColor: "#eef2f6", cursor: "not-allowed" };
    default: return { ...base, background: "#fff", color: "#cbd5e1", borderColor: "#eef2f0" };
  }
};

function Leg({ sw, bd, t }: { sw: string; bd: string; t: string }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: sw, border: `1px solid ${bd}` }} />{t}</span>;
}
