"use client";

import React from "react";
import type { Booking, Court } from "@/lib/types";
import { hourRange, prettyDate } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { Avatar, Modal, StatusPill } from "./ui";
import ProofImage from "./ProofImage";
import { C, FONT_DISPLAY } from "@/lib/theme";

export default function BookingDetailModal({
  booking,
  courts,
  onClose,
  footer,
  extra,
}: {
  booking: Booking | null;
  courts: Court[];
  onClose: () => void;
  footer?: React.ReactNode;
  // Optional slot rendered at the end of the body (e.g. the customer's
  // "complete payment" panel for a held booking).
  extra?: React.ReactNode;
}) {
  const court = booking ? courts.find((c) => c.id === booking.courtId) : undefined;
  const created = booking ? new Date(booking.createdAt) : null;

  return (
    <Modal open={!!booking} onClose={onClose} maxWidth={480} title={booking ? `Booking ${booking.ref}` : ""} subtitle={court?.name} footer={footer}>
      {booking && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <Avatar name={booking.customerName} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{booking.customerName}</div>
              <div style={{ fontSize: 12.5, color: C.faint }}>{booking.customerEmail}</div>
            </div>
            <StatusPill status={booking.status} seen={booking.seenByAdmin} />
          </div>

          <div style={{ background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 14, padding: 14 }}>
            <Row label="Court" value={court ? court.name : booking.courtName} />
            {court && <Row label="Surface" value={court.surface} />}
            {created && <Row label="Booked on" value={created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " + created.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />}
            {/* While the receipt is on hand, show it. Once payment has been
                verified the method + reference ARE the record, so we report
                that instead of commenting on the image. */}
            {booking.hasProof ? (
              <>
                <Row label="Proof of payment" value={booking.proofFileName || "Uploaded"} mono />
                <div style={{ marginTop: 10 }}>
                  <ProofImage bookingId={booking.id} height={180} />
                </div>
              </>
            ) : (
              !booking.paymentMethod && <Row label="Proof of payment" value="Not uploaded" />
            )}

            {booking.paymentMethod && (
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: C.offBg, border: `1px solid ${C.offBorder}`, borderRadius: 11 }}>
                <span style={{ color: C.green, fontSize: 15, lineHeight: 1 }}>✓</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.offInkD }}>Payment verified</div>
                  <div style={{ fontSize: 11.5, color: C.muted, wordBreak: "break-all" }}>
                    {booking.paymentMethod}{booking.paymentReference ? ` · ref ${booking.paymentReference}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, margin: "16px 0 8px" }}>
            {booking.slots.length} hour{booking.slots.length > 1 ? "s" : ""} booked
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {booking.slots.map((s) => {
              // Frozen price from booking time — never recomputed, so changing
              // rates or peak hours can't reprice a booking already made.
              const peak = court ? s.rate === court.peakRate : false;
              return (
                <div key={s.date + s.hour} style={{ display: "flex", alignItems: "center", fontSize: 13.5 }}>
                  <span style={{ color: C.slate }}>{prettyDate(s.date)} · {hourRange(s.hour)}</span>
                  <span style={{ marginLeft: 10, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, color: peak ? C.peakInk : C.offInk, background: peak ? C.peakBg : C.offBg }}>{peak ? "Peak" : "Off peak"}</span>
                  <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{peso(s.rate)}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: `1px dashed ${C.border}`, paddingTop: 12, marginTop: 14 }}>
            <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22 }}>{peso(booking.total)}</span>
          </div>

          {booking.note && (
            <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: booking.status === "rejected" ? C.blockInk2 : C.muted, background: booking.status === "rejected" ? C.blockBg : "#f7faf9", border: `1px solid ${booking.status === "rejected" ? C.blockBorder : C.border2}`, borderRadius: 11, padding: "10px 12px" }}>
              {booking.note}
            </div>
          )}

          {extra}
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, padding: "3px 0" }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", fontFamily: mono ? "monospace" : undefined, fontSize: mono ? 12 : undefined, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
