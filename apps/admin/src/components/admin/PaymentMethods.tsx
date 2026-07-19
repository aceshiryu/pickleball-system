"use client";

import React, { useRef, useState } from "react";
import { useStore } from "@shared/lib/store";
import type { PaymentMethod, PaymentMethodType } from "@shared/lib/types";
import { prepareQr } from "@shared/lib/image";
import { C, FONT_DISPLAY, primaryBtn } from "@shared/lib/theme";

// Shared payment-methods editor — used by both onboarding and Settings so the
// two can't drift. Reads and writes the facility's methods through the store.
//
// Flow the admin sees: pick a type, which opens a draft form (nothing is saved
// yet), fill the type's required fields, optionally attach a QR, then Save —
// which adds it to the list. Any listed method can be edited or removed.

type Draft = PaymentMethod;

const TYPE_META: Record<PaymentMethodType, { label: string; blurb: string }> = {
  gcash: { label: "GCash", blurb: "Mobile number required, QR optional" },
  maya: { label: "Maya", blurb: "Mobile number required, QR optional" },
  bank: { label: "Bank transfer", blurb: "Bank, account no. & name; QR optional" },
  cash: { label: "Cash", blurb: "Pay at the facility" },
  other: { label: "Other", blurb: "Any method — just a label" },
};

const ADD_ORDER: PaymentMethodType[] = ["gcash", "maya", "bank", "cash", "other"];

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "m_" + Math.random().toString(36).slice(2, 10);
}

function blankFor(type: PaymentMethodType): Draft {
  const label = type === "bank" || type === "other" ? "" : TYPE_META[type].label;
  return { id: newId(), type, label, phone: "", bankName: "", accountNumber: "", accountName: "", qr: null };
}

// Summary line under a saved method's name.
function detailLine(m: PaymentMethod): string {
  if (m.type === "gcash" || m.type === "maya") return m.phone || "No number set";
  if (m.type === "bank") return [m.accountNumber, m.accountName].filter(Boolean).join(" · ") || "No account set";
  if (m.type === "cash") return "Pay at the facility";
  return "Custom method";
}

export default function PaymentMethods() {
  const { paymentMethods, savePaymentMethod, removePaymentMethod } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);

  function edit(m: PaymentMethod) {
    setDraft({ ...m });
  }
  function save() {
    if (!draft) return;
    const d = normalize(draft);
    const err = validate(d);
    if (err) return; // the form disables Save, this is just a guard
    savePaymentMethod(d);
    setDraft(null);
  }

  const editingId = draft && paymentMethods.some((m) => m.id === draft.id) ? draft.id : null;

  return (
    <div>
      {paymentMethods.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {paymentMethods.map((m) =>
            editingId === m.id ? (
              <DraftForm key={m.id} draft={draft!} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} />
            ) : (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${C.border2}`, borderRadius: 11 }}>
                {m.qr ? (
                  <img src={m.qr} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border2}` }} />
                ) : (
                  <div style={{ width: 34, height: 34, borderRadius: 7, background: C.offBg, color: C.offInkD, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{(m.label || "?").slice(0, 2).toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label || TYPE_META[m.type].label}</div>
                  <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detailLine(m)}</div>
                </div>
                <button onClick={() => edit(m)} style={linkBtn(C.green)}>Edit</button>
                <button onClick={() => removePaymentMethod(m.id)} style={linkBtn(C.blockInk2)}>Remove</button>
              </div>
            ),
          )}
        </div>
      )}

      {/* New draft (not yet in the list) renders its form here. */}
      {draft && !editingId && (
        <DraftForm draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraft(null)} />
      )}

      {!draft && (
        <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Add a payment method</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ADD_ORDER.map((t) => (
              <button key={t} onClick={() => setDraft(blankFor(t))} title={TYPE_META[t].blurb} style={{ padding: "7px 13px", borderRadius: 999, border: `1px solid ${C.border}`, background: "#fff", fontSize: 12.5, fontWeight: 600, color: C.slate, cursor: "pointer" }}>+ {TYPE_META[t].label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Coerce fields to what the type actually uses, so an abandoned bank draft
// switched to cash doesn't ship stale account fields, and bank's label tracks
// the bank name (what the customer picks at checkout).
function normalize(d: Draft): Draft {
  const base: Draft = { id: d.id, type: d.type, label: d.label.trim(), qr: d.qr || null };
  if (d.type === "gcash" || d.type === "maya") {
    return { ...base, label: base.label || TYPE_META[d.type].label, phone: (d.phone || "").trim() };
  }
  if (d.type === "bank") {
    const bankName = (d.bankName || "").trim();
    return { ...base, label: bankName || "Bank transfer", bankName, accountNumber: (d.accountNumber || "").trim(), accountName: (d.accountName || "").trim() };
  }
  if (d.type === "cash") return { ...base, label: base.label || "Cash", qr: null };
  return { ...base }; // other
}

// Returns an error string if required fields are missing, else null.
function validate(d: Draft): string | null {
  if (d.type === "gcash" || d.type === "maya") return d.phone ? null : "Enter the mobile number.";
  if (d.type === "bank") {
    if (!d.bankName) return "Enter the bank name.";
    if (!d.accountNumber) return "Enter the account number.";
    if (!d.accountName) return "Enter the account name.";
    return null;
  }
  if (d.type === "other") return d.label ? null : "Enter a name for this method.";
  return null; // cash
}

function DraftForm({ draft, setDraft, onSave, onCancel }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [qrErr, setQrErr] = useState("");
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const invalid = validate(normalize(draft));
  const t = draft.type;
  const showQr = t !== "cash";

  async function pickQr(file: File) {
    setQrErr("");
    try {
      set({ qr: await prepareQr(file) });
    } catch (e) {
      setQrErr(e instanceof Error ? e.message : "Could not read that image.");
    }
  }

  return (
    <div style={{ border: `1px solid ${C.green}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: C.greenD }}>{TYPE_META[t].label}</div>

      {t === "other" && (
        <div style={{ marginBottom: 8 }}><FL>Name</FL><input autoFocus value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. PayMaya QR, Coins.ph" maxLength={60} style={fld} /></div>
      )}

      {(t === "gcash" || t === "maya") && (
        <div style={{ marginBottom: 8 }}><FL>Mobile number <Req /></FL><input autoFocus value={draft.phone || ""} onChange={(e) => set({ phone: e.target.value })} placeholder="0917 123 4567" maxLength={40} style={fld} /></div>
      )}

      {t === "bank" && (
        <>
          <div style={{ marginBottom: 8 }}><FL>Bank <Req /></FL><input autoFocus value={draft.bankName || ""} onChange={(e) => set({ bankName: e.target.value })} placeholder="e.g. BPI, BDO" maxLength={60} style={fld} /></div>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><FL>Account no. <Req /></FL><input value={draft.accountNumber || ""} onChange={(e) => set({ accountNumber: e.target.value })} placeholder="1234-5678-90" maxLength={60} style={fld} /></div>
            <div style={{ flex: 1 }}><FL>Account name <Req /></FL><input value={draft.accountName || ""} onChange={(e) => set({ accountName: e.target.value })} placeholder="Juan Dela Cruz" maxLength={80} style={fld} /></div>
          </div>
        </>
      )}

      {showQr && (
        <div style={{ marginBottom: 10 }}>
          <FL>QR code <span style={{ color: C.faint, fontWeight: 500 }}>(optional)</span></FL>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickQr(f); }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {draft.qr ? (
              <img src={draft.qr} alt="QR preview" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.border}` }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 8, border: `1.5px dashed #cbd5cf`, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint, fontSize: 18 }}>▦</div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fileRef.current?.click()} style={ghostBtn}>{draft.qr ? "Change" : "Upload QR"}</button>
              {draft.qr && <button onClick={() => set({ qr: null })} style={ghostBtn}>Remove</button>}
            </div>
          </div>
          {qrErr && <div style={{ fontSize: 12, color: "#e11d48", marginTop: 6 }}>{qrErr}</div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={!!invalid} title={invalid || ""} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13, boxShadow: "none", background: invalid ? "#cbd5cf" : primaryBtn.background, cursor: invalid ? "not-allowed" : "pointer" }}>Save method</button>
        <button onClick={onCancel} style={{ flex: 1, padding: 10, border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function Req() { return <span style={{ color: "#f43f5e" }}>*</span>; }
function FL({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 5 }}>{children}</div>;
}
function linkBtn(color: string): React.CSSProperties {
  return { fontSize: 12.5, fontWeight: 600, color, background: "none", border: "none", cursor: "pointer", flexShrink: 0 };
}
const fld: React.CSSProperties = { width: "100%", padding: "9px 11px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13.5, outline: "none", background: "#fff" };
const ghostBtn: React.CSSProperties = { padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff", color: C.slate, fontWeight: 600, fontSize: 12.5, cursor: "pointer" };
