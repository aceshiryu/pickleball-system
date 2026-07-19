"use client";

import React, { useState } from "react";
import { Receipt } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { hourRange, prettyDate } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { Avatar, Modal, StatusPill, iconBtn } from "../ui";
import ProofImage from "../ProofImage";
import { useConfirm } from "../Confirm";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

const PRESETS = ["Receipt unreadable", "Amount mismatch", "No proof attached"];

const fld: React.CSSProperties = { width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: FONT_DISPLAY, fontSize: 13.5, boxSizing: "border-box", color: C.slate, background: "#fff" };

export default function Approvals() {
  const { bookings, courts, customers, paymentMethods, approveBooking, rejectBooking, acknowledgeBooking } = useStore();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("");
  const [refNo, setRefNo] = useState("");
  const [payErr, setPayErr] = useState("");

  // The methods this facility actually accepts, configured in Settings.
  // Staff record which method the customer used; the label is the choice.
  const METHODS = paymentMethods.map((m) => m.label);

  const pending = bookings.filter((b) => b.status === "pending_approval");
  const resolved = bookings.filter((b) => b.status === "confirmed" || b.status === "rejected").sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6);
  const list = filter === "pending" ? pending : filter === "resolved" ? resolved : [...pending, ...resolved];

  const rv = reviewId ? bookings.find((b) => b.id === reviewId) : null;
  const court = (id: string) => courts.find((c) => c.id === id);

  function openReview(b: Booking) {
    if (!b.seenByAdmin && b.status === "pending_approval") acknowledgeBooking(b.id);
    setReviewId(b.id);
    setRejectMode(false);
    setReason("");
    setMethod("");
    setRefNo("");
    setPayErr("");
  }
  // Lives on the booking now, so it resolves for walk-ins with no account too.
  const phoneOf = (b: Booking) => b.contactPhone || customers.find((c) => c.id === b.customerId)?.phone || "";

  async function doApprove() {
    if (!rv) return;
    // Both are required: they're the record that someone actually looked the
    // payment up before confirming.
    if (!method) return setPayErr("Select the payment method the money arrived on.");
    if (!refNo.trim()) return setPayErr("Enter the payment reference number.");
    setPayErr("");
    if (await confirm({
      title: "Payment verified?",
      message: `You're confirming you found ${peso(rv.total)} from ${rv.customerName} on ${method} (ref ${refNo.trim()}). This marks the booking paid and emails their confirmation.`,
      confirmLabel: "Yes, payment received",
    })) {
      approveBooking(rv.id, method, refNo.trim());
      setReviewId(null);
    }
  }
  async function doReject() {
    if (!rv) return;
    if (await confirm({ title: "Reject this booking?", message: "The customer will be notified and the slots reopened.", confirmLabel: "Reject booking", danger: true })) {
      rejectBooking(rv.id, reason || "Payment could not be verified.");
      setReviewId(null);
      setRejectMode(false);
      setReason("");
    }
  }

  const tabs: [typeof filter, string, number][] = [["pending", "Pending", pending.length], ["resolved", "Resolved", 0], ["all", "All", 0]];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, background: "#eef2f0", padding: 4, borderRadius: 12, marginBottom: 18, width: "fit-content" }}>
        {tabs.map(([id, label, count]) => {
          const active = filter === id;
          return (
            <button key={id} onClick={() => setFilter(id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: FONT_DISPLAY, background: active ? "#fff" : "transparent", color: active ? C.greenD : C.muted, boxShadow: active ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>
              {label}{count > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, color: "#fff", background: active ? C.green : C.faint }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {list.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((a) => (
            <div key={a.id} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,.03)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Avatar name={a.customerName} />
              <div style={{ minWidth: 160, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{a.customerName}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.faint, background: "#f1f5f4", padding: "2px 8px", borderRadius: 999 }}>{a.ref}</span>
                </div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{a.courtName} · {a.hours} hr{a.hours > 1 ? "s" : ""} · {a.slots[0] && prettyDate(a.slots[0].date)}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{a.customerEmail} · {phoneOf(a)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>{peso(a.total)}</div>
              </div>
              <StatusPill status={a.status} seen={a.seenByAdmin} />
              {a.status === "pending_approval" && (
                <button onClick={() => openReview(a)} style={{ padding: "11px 18px", border: "none", borderRadius: 12, background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Review proof</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "70px 20px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>Nothing here</div>
          <div style={{ fontSize: 13.5, color: C.faint, marginTop: 5 }}>No bookings match this filter.</div>
        </div>
      )}

      <Modal
        open={!!rv}
        onClose={() => { setReviewId(null); setRejectMode(false); }}
        maxWidth={560}
        title={rv?.customerName ?? ""}
        subtitle={rv ? `${rv.customerEmail} · ${rv.ref}` : ""}
        footer={rv ? (rejectMode ? (
          <>
            <button onClick={() => setRejectMode(false)} style={{ padding: "13px 18px", border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={doReject} style={{ flex: 1, padding: 13, border: "none", borderRadius: 12, background: "#e11d48", color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Confirm rejection</button>
          </>
        ) : (
          <>
            <button onClick={() => setRejectMode(true)} style={{ flex: 1, padding: 14, border: `1px solid ${C.blockBorder}`, borderRadius: 13, background: "#fff", color: C.blockInk2, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Reject</button>
            <button
              onClick={doApprove}
              disabled={!method || !refNo.trim()}
              title={!method || !refNo.trim() ? "Record the payment method and reference first" : undefined}
              style={{ ...primaryBtn, flex: 2, padding: 14, fontSize: 14, background: method && refNo.trim() ? primaryBtn.background : "#cbd5cf", boxShadow: method && refNo.trim() ? primaryBtn.boxShadow : "none", cursor: method && refNo.trim() ? "pointer" : "not-allowed" }}
            >
              Approve &amp; confirm
            </button>
          </>
        )) : undefined}
      >
        {rv && (
          <>
            <div style={{ background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 6 }}>Customer contact</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
                <span style={{ fontSize: 13, color: C.slate }}>✉ {rv.customerEmail}</span>
                <span style={{ fontSize: 13, color: C.slate }}>☎ {phoneOf(rv) || "Not provided"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 10 }}>Booking · {rv.ref}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  {rv.slots.map((s) => {
                    // Frozen booking-time price, not today's rate.
                    const c = court(rv.courtId);
                    const peak = c ? s.rate === c.peakRate : false;
                    return (
                      <div key={s.date + s.hour} style={{ display: "flex", alignItems: "center", fontSize: 13.5 }}>
                        <span style={{ color: C.slate }}>{prettyDate(s.date)} · {hourRange(s.hour)}</span>
                        <span style={{ marginLeft: 10, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, color: peak ? C.peakInk : C.offInk, background: peak ? C.peakBg : C.offBg }}>{peak ? "Peak" : "Off-peak"}</span>
                        <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{peso(s.rate)}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: `1px dashed ${C.border}`, paddingTop: 12 }}>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Total due</span>
                  <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22 }}>{peso(rv.total)}</span>
                </div>
              </div>
              <div style={{ width: 170, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 10 }}>Payment proof</div>
                {rv.hasProof ? (
                  <ProofImage bookingId={rv.id} height={200} />
                ) : (
                  <div style={{ height: 200, borderRadius: 14, border: `1px solid ${C.border}`, backgroundImage: "repeating-linear-gradient(45deg,#eef2f0,#eef2f0 8px,#f7faf9 8px,#f7faf9 16px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><Receipt style={{ width: 18, height: 18 }} /></div>
                    <span style={{ fontFamily: "monospace", fontSize: 10.5, color: C.muted2, textAlign: "center", padding: "0 10px", wordBreak: "break-all" }}>{rv.proofFileName || "No proof uploaded"}</span>
                  </div>
                )}
              </div>
            </div>
            {!rejectMode && (
              <div style={{ marginTop: 18, borderTop: `1px dashed ${C.border}`, paddingTop: 16 }}>
                {/* Double-check note — the whole point of this step. */}
                <div style={{ display: "flex", gap: 10, background: C.peakBg, border: `1px solid ${C.peakBorder}`, borderRadius: 12, padding: "11px 13px", marginBottom: 14 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.2 }}>⚠️</span>
                  <div style={{ fontSize: 12.5, color: C.peakInkD, lineHeight: 1.55 }}>
                    <strong>Double-check the payment before confirming.</strong> The
                    screenshot on the right is only what the customer uploaded — it
                    isn&apos;t proof the money arrived. Open your {METHODS.filter((m) => m !== "Cash").join(" / ") || "payment"} account,
                    find the transaction, and match the <strong>amount ({peso(rv.total)})</strong> and{" "}
                    <strong>reference number</strong> before approving. Confirming marks
                    the booking paid and emails the customer.
                  </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 10 }}>Record the payment</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                      Payment method <span style={{ color: "#f43f5e" }}>*</span>
                    </div>
                    <select value={method} onChange={(e) => { setMethod(e.target.value); setPayErr(""); }} style={fld}>
                      <option value="">Select method…</option>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                      Reference number <span style={{ color: "#f43f5e" }}>*</span>
                    </div>
                    <input value={refNo} onChange={(e) => { setRefNo(e.target.value); setPayErr(""); }} placeholder="e.g. 0012 3456 7890" style={fld} />
                  </div>
                </div>
                {payErr && <div style={{ marginTop: 9, fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>{payErr}</div>}
              </div>
            )}

            {rejectMode && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 8 }}>Reason for rejection</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {PRESETS.map((r) => (
                    <button key={r} onClick={() => setReason(r)} style={{ padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontWeight: 600, border: `1px solid ${reason === r ? "#f43f5e" : C.border}`, background: reason === r ? C.blockBg : "#fff", color: reason === r ? C.blockInk2 : C.muted }}>{r}</button>
                  ))}
                </div>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Add a note the customer will see…" style={{ width: "100%", minHeight: 70, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, fontFamily: FONT_DISPLAY, fontSize: 13.5, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
