"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { peso } from "@/lib/pricing";
import { prepareReceipt } from "@/lib/image";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";
import PaymentInstructions from "./PaymentInstructions";

// Lets a customer finish paying for a still-held booking straight from My
// bookings: shows the same payment methods as the checkout modal, takes a receipt
// upload, and resubmits the hold for admin approval (status -> pending_approval).
export default function HoldPayment({
  booking,
  onDone,
}: {
  booking: Booking;
  onDone: () => void;
}) {
  const { paymentMethods, submitPayment } = useStore();
  const [receipt, setReceipt] = useState("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [payError, setPayError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresAt = booking.holdExpiresAt
    ? new Date(booking.holdExpiresAt).getTime()
    : null;
  const secLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const expired = expiresAt !== null && secLeft <= 0;

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");
  let cdBg = "#f0f9ff",
    cdFg = "#0369a1",
    cdHint = "Pay, upload your receipt, then submit for approval.";
  if (secLeft <= 60) {
    cdBg = "#fff1f2";
    cdFg = "#be123c";
    cdHint = "Hold ending soon, submit now to keep your slots.";
  } else if (secLeft <= 180) {
    cdBg = "#fffbeb";
    cdFg = "#b45309";
    cdHint = "A few minutes left to complete your payment.";
  }

  async function submit() {
    if (busy || expired) return;
    if (!receipt) {
      setPayError(true);
      return;
    }
    setBusy(true);
    try {
      await submitPayment([booking.id], receipt, receiptImage ?? undefined);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          background: C.blockBg,
          border: `1px solid ${C.blockBorder}`,
          color: C.blockInk2,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ fontFamily: FONT_DISPLAY }}>Hold expired.</strong> The
        10-minute hold ran out and these slots were released. Please book them
        again from the calendar.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${C.border}` }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        Complete your payment
      </div>

      {/* Countdown */}
      <div style={{ textAlign: "center", padding: 14, borderRadius: 14, color: cdFg, background: cdBg }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Your slots are held for</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, letterSpacing: ".02em", lineHeight: 1, marginTop: 4 }}>
          {mm}:{ss}
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 5 }}>{cdHint}</div>
      </div>

      {/* Accepted payment methods */}
      <div style={{ margin: "16px 0 12px" }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>
          Pay <strong style={{ color: C.green }}>{peso(booking.total)}</strong> using any method below, then upload your receipt.
        </div>
        <PaymentInstructions methods={paymentMethods} />
      </div>

      {/* Upload */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 8 }}>
        Upload payment receipt <span style={{ color: "#f43f5e" }}>*</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPayError(false);
          prepareReceipt(file)
            .then((r) => { setReceipt(r.fileName); setReceiptImage(r.dataUrl); })
            .catch(() => setPayError(true));
        }}
      />
      {!receipt ? (
        <button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 22, border: "1.5px dashed #cbd5cf", borderRadius: 14, cursor: "pointer", background: "#f7faf9" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.offBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, fontSize: 18, fontWeight: 700 }}>↑</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>Tap to upload a screenshot</span>
          <span style={{ fontSize: 11.5, color: C.faint }}>PNG or JPG · required to submit</span>
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: `1px solid ${C.offBorder}`, borderRadius: 12, background: C.offBg }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.offInkD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receipt}</div>
            <div style={{ fontSize: 11.5, color: C.green }}>Receipt attached</div>
          </div>
          <button onClick={() => { setReceipt(""); setReceiptImage(null); }} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Replace</button>
        </div>
      )}
      {payError && <div style={{ marginTop: 10, fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>Please upload your payment receipt before submitting.</div>}

      <button
        onClick={submit}
        disabled={busy}
        style={{ ...primaryBtn, width: "100%", marginTop: 16, padding: 14, fontSize: 15, borderRadius: 13, opacity: busy ? 0.7 : 1, cursor: busy ? "default" : "pointer" }}
      >
        {busy ? "Submitting…" : "Submit payment for approval"}
      </button>
    </div>
  );
}
