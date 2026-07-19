"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { SelItem } from "@/lib/store";
import type { Customer } from "@/lib/types";
import { hourRange, prettyDate } from "@/lib/dates";
import { peso } from "@/lib/pricing";
import { Modal } from "../ui";
import SlotCalendar from "../SlotCalendar";
import { cartTotal, groupByCourt } from "../customer/Cart";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

// Front-desk booking, as a stepper: schedule -> customer -> payment.
// Step 1 is the same calendar the customers use (SlotCalendar), with past hours
// allowed so a walk-in can take the hour already in progress.

type Step = 0 | 1 | 2;
const STEPS = ["Schedule", "Customer", "Payment"];

export default function AddBooking({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { courts, customers, paymentMethods, peakSchedule, adminCreateBooking } = useStore();

  const [step, setStep] = useState<Step>(0);
  const [selected, setSelected] = useState<SelItem[]>([]);

  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [method, setMethod] = useState("");
  const [refNo, setRefNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const METHODS = paymentMethods.map((m) => m.label);
  const isCash = method.trim().toLowerCase() === "cash";
  const total = useMemo(() => cartTotal(selected, courts, peakSchedule), [selected, courts, peakSchedule]);
  const groups = useMemo(() => groupByCourt(selected, courts), [selected, courts]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelected([]);
    setSearch(""); setPicked(null); setName(""); setPhone(""); setEmail("");
    setMethod(""); setRefNo(""); setError(""); setBusy(false);
  }, [open]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [search, customers]);

  function pick(c: Customer) {
    setPicked(c);
    setName(c.name);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setSearch("");
    setError("");
  }

  function next() {
    setError("");
    if (step === 0) {
      if (selected.length === 0) return setError("Select at least one hour on the calendar.");
      return setStep(1);
    }
    if (step === 1) {
      if (!name.trim()) return setError("Enter the customer's name.");
      if (!phone.trim()) return setError("Enter a contact number.");
      return setStep(2);
    }
    void submit();
  }
  function back() {
    setError("");
    setStep((s) => (s > 0 ? ((s - 1) as Step) : s));
  }

  async function submit() {
    if (busy) return;
    if (!method) return setError("Select how they paid.");
    if (!isCash && !refNo.trim()) return setError("Enter the payment reference number.");
    setBusy(true);
    try {
      await adminCreateBooking({
        items: selected,
        customerId: picked?.id,
        contact: { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined },
        paymentMethod: method,
        referenceNumber: isCash ? undefined : refNo.trim(),
      });
      onClose();
    } catch (e) {
      // e.g. 409 if someone took the slot while the desk was typing
      setError(e instanceof Error ? e.message : "Could not create the booking.");
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  const nextLabel = step === 2 ? (busy ? "Booking…" : `Confirm · ${peso(total)}`) : "Next";

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth={step === 0 ? 1040 : 560}
      title="Add booking"
      subtitle={`Step ${step + 1} of 3 · ${STEPS[step]}`}
      footer={
        <>
          <button
            onClick={step === 0 ? onClose : back}
            style={{ padding: "13px 18px", border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={next}
            disabled={busy || (step === 0 && selected.length === 0)}
            style={{ ...primaryBtn, flex: 1, padding: 13, fontSize: 14, background: !busy && (step > 0 || selected.length > 0) ? primaryBtn.background : "#cbd5cf", boxShadow: "none", cursor: busy || (step === 0 && selected.length === 0) ? "not-allowed" : "pointer" }}
          >
            {nextLabel}
          </button>
        </>
      }
    >
      <Stepper step={step} />

      {/* 1 — schedule: the same calendar customers book on */}
      {step === 0 && (
        <>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: C.muted }}>
            Tap a slot, or drag down a column, to take several hours. The hour already in progress is bookable for walk-ins.
          </p>
          <SlotCalendar selected={selected} onChange={setSelected} allowPast />
          <div style={{ marginTop: 14, fontSize: 13, color: selected.length ? C.slate : C.faint }}>
            {selected.length
              ? <><b>{selected.length} hr{selected.length === 1 ? "" : "s"}</b> selected · <b>{peso(total)}</b></>
              : "Nothing selected yet."}
          </div>
        </>
      )}

      {/* 2 — customer */}
      {step === 1 && (
        <>
          <Summary groups={groups} total={total} />
          <div style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
            Link an account if they have one — otherwise just take their contact details, an account isn&apos;t required.
          </div>

          {picked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${C.offBorder}`, borderRadius: 11, background: C.offBg, marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.offInkD }}>{picked.name}</div>
                <div style={{ fontSize: 12, color: C.green }}>Existing account · {picked.email}</div>
              </div>
              <button onClick={() => { setPicked(null); setName(""); setPhone(""); setEmail(""); }} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Change</button>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <Label>Search existing customer</Label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, mobile number or email…" style={fld} />
              {matches.length > 0 && (
                <div style={{ marginTop: 6, border: `1px solid ${C.border}`, borderRadius: 11, overflow: "hidden" }}>
                  {matches.map((c) => (
                    <button key={c.id} onClick={() => pick(c)} style={{ width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: `1px solid ${C.border3}`, background: "#fff", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: C.faint }}>{c.phone || "no number"} · {c.email}</div>
                    </button>
                  ))}
                </div>
              )}
              {search.trim() && matches.length === 0 && (
                <div style={{ marginTop: 6, fontSize: 12.5, color: C.faint }}>No match — just fill in the contact details below.</div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Label>Name <Req /></Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria Santos" style={fld} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Label>Mobile number <Req /></Label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0917 000 0000" style={fld} />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <Label>Email <Opt /></Label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" style={fld} />
            </div>
          </div>
        </>
      )}

      {/* 3 — payment */}
      {step === 2 && (
        <>
          <Summary groups={groups} total={total} who={name} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Label>Paid via <Req /></Label>
              <select value={method} onChange={(e) => { setMethod(e.target.value); setError(""); }} style={fld}>
                <option value="">Select method…</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Label>Reference number {isCash ? <Opt text="not needed for cash" /> : <Req />}</Label>
              <input
                value={isCash ? "" : refNo}
                onChange={(e) => { setRefNo(e.target.value); setError(""); }}
                disabled={isCash}
                placeholder={isCash ? "—" : "e.g. 0012 3456 7890"}
                style={{ ...fld, background: isCash ? "#f7faf9" : "#fff", color: isCash ? C.faint : C.slate }}
              />
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: C.muted, lineHeight: 1.55, background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 11, padding: "10px 12px" }}>
            Confirming books the court straight away — no approval step, since you&apos;re taking the payment yourself. The slot is blocked for everyone else immediately.
          </div>
        </>
      )}

      {error && <div style={{ marginTop: 12, fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>{error}</div>}
    </Modal>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const on = i === step;
        return (
          <React.Fragment key={label}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, flexShrink: 0, background: done ? C.green : on ? C.dark : "#eef2f0", color: done || on ? "#fff" : C.faint }}>
                {done ? "✓" : i + 1}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? C.ink2 : done ? C.green : C.faint, whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: i < step ? C.green : C.border, minWidth: 16 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Summary({ groups, total, who }: { groups: ReturnType<typeof groupByCourt>; total: number; who?: string }) {
  return (
    <div style={{ background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
      {groups.map((g) => (
        <div key={g.court.id} style={{ marginBottom: 6 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13 }}>{g.court.name}</div>
          {g.slots.map((s) => (
            <div key={s.date + s.hour} style={{ fontSize: 12.5, color: C.muted }}>
              {prettyDate(s.date)} · {hourRange(s.hour)}
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderTop: `1px dashed ${C.border}`, paddingTop: 8, marginTop: 8 }}>
        <span style={{ fontSize: 12.5, color: C.muted, fontWeight: 600 }}>{who ? who : "Total"}</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>{peso(total)}</span>
      </div>
    </div>
  );
}

const fld: React.CSSProperties = { width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: FONT_DISPLAY, fontSize: 13.5, boxSizing: "border-box", color: C.slate, background: "#fff" };

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{children}</div>;
}
function Req() {
  return <span style={{ color: "#f43f5e" }}>*</span>;
}
function Opt({ text = "optional" }: { text?: string }) {
  return <span style={{ color: C.faint, fontWeight: 500 }}>({text})</span>;
}
