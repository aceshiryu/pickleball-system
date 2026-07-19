"use client";

import React, { useState } from "react";
import { C, FONT_DISPLAY, primaryBtn } from "@shared/lib/theme";
import { Brand } from "@shared/components/ui";

export const TERMS_TEXT: string[] = [
  "1. Reserved slots are held for 10 minutes pending payment. Unpaid holds are released automatically and the hours reopen for others.",
  "2. Bookings are confirmed only after an administrator verifies your uploaded payment proof. Until then your status remains pending.",
  "3. Peak pricing applies on weekends and weekday evenings from 5 PM. Rates shown at selection are final for that slot.",
  "4. Cancellations made by an administrator (e.g. maintenance) reopen your hours and are eligible for a full re-book.",
  "5. Please arrive 10 minutes early. Courts not claimed within 15 minutes of start may be released.",
];

export default function TermsGate({
  onAccept,
  onCancel,
}: {
  onAccept: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: C.bg }}>
      <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: "0 20px 50px -24px rgba(2,20,10,.35)", overflow: "hidden" }}>
        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.border3}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Brand size={34} subtitle="" />
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: C.ink2 }}>Terms &amp; Conditions</span>
        </div>
        <div style={{ padding: 22 }}>
          <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 14px" }}>
            Please review and accept our terms to continue.
          </p>
          <div style={{ height: 220, overflowY: "auto", background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 1.65, color: "#475569" }} className="thin-scroll">
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: C.ink2 }}>Court booking terms</strong></p>
            {TERMS_TEXT.map((t, i) => (
              <p key={i} style={{ margin: "0 0 10px" }}>{t}</p>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: 12, marginTop: 14, border: `1px solid ${checked ? C.offBorder : C.border}`, borderRadius: 12, background: "#fff" }}>
            <span
              onClick={() => setChecked((v) => !v)}
              style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", border: `1.5px solid ${checked ? C.green : "#cbd5cf"}`, background: checked ? C.green : "#fff" }}
            >
              {checked ? "✓" : ""}
            </span>
            <span style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.5 }}>
              I have read and agree to the Terms &amp; Conditions and Privacy Policy.
            </span>
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={onCancel} style={{ padding: "13px 18px", border: `1px solid ${C.border}`, borderRadius: 13, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              Sign out
            </button>
            <button
              onClick={() => checked && onAccept()}
              disabled={!checked}
              style={{ ...primaryBtn, flex: 1, padding: 14, fontSize: 15, opacity: checked ? 1 : 0.5, cursor: checked ? "pointer" : "not-allowed", background: checked ? primaryBtn.background : "#cbd5cf", boxShadow: checked ? primaryBtn.boxShadow : "none" }}
            >
              Accept &amp; continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
