"use client";

import React, { useState } from "react";
import type { PaymentMethod } from "@/lib/types";
import { C, FONT_DISPLAY } from "@/lib/theme";

// Read-only payment details a customer sees at checkout / on a held booking:
// the facility's accepted methods, each with the phone, bank account, and QR
// they need to actually pay. Shared by Checkout and HoldPayment.
export default function PaymentInstructions({ methods }: { methods: PaymentMethod[] }) {
  if (methods.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: C.faint, padding: "10px 12px", background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12 }}>
        Ask the facility for payment details, then upload your receipt below.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {methods.map((m) => <MethodCard key={m.id} m={m} />)}
    </div>
  );
}

function MethodCard({ m }: { m: PaymentMethod }) {
  const [zoom, setZoom] = useState(false);
  const rows = detailRows(m);
  return (
    <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12, background: "#fff" }}>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, marginBottom: rows.length ? 6 : 0 }}>{m.label}</div>
          {rows.map((r) => (
            <div key={r.k} style={{ display: "flex", gap: 8, fontSize: 12.5, marginBottom: 2 }}>
              <span style={{ color: C.faint, minWidth: 78 }}>{r.k}</span>
              <span style={{ color: C.slate, fontWeight: 600, wordBreak: "break-word" }}>{r.v}</span>
            </div>
          ))}
        </div>
        {m.qr && (
          <button onClick={() => setZoom(true)} title="Tap to enlarge" style={{ padding: 0, border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff", cursor: "zoom-in", flexShrink: 0, lineHeight: 0 }}>
            <img src={m.qr} alt={`${m.label} QR`} style={{ width: 72, height: 72, borderRadius: 9, objectFit: "cover", display: "block" }} />
          </button>
        )}
      </div>
      {zoom && m.qr && (
        <div onClick={() => setZoom(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(2,20,10,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 16, textAlign: "center", maxWidth: 340 }}>
            <img src={m.qr} alt={`${m.label} QR`} style={{ width: "100%", maxWidth: 300, borderRadius: 10, display: "block" }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, marginTop: 10 }}>{m.label}</div>
            <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>Tap anywhere to close</div>
          </div>
        </div>
      )}
    </div>
  );
}

function detailRows(m: PaymentMethod): { k: string; v: string }[] {
  if (m.type === "gcash" || m.type === "maya") {
    return m.phone ? [{ k: "Mobile no.", v: m.phone }] : [];
  }
  if (m.type === "bank") {
    const rows: { k: string; v: string }[] = [];
    if (m.bankName) rows.push({ k: "Bank", v: m.bankName });
    if (m.accountNumber) rows.push({ k: "Account no.", v: m.accountNumber });
    if (m.accountName) rows.push({ k: "Account name", v: m.accountName });
    return rows;
  }
  if (m.type === "cash") return [{ k: "", v: "Pay at the facility." }];
  return [];
}
