"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@shared/lib/store";
import type { SelItem } from "@shared/lib/store";
import { ApiError } from "@shared/lib/api-client";
import type { Booking, Court } from "@shared/lib/types";
import { hourRange, prettyDate } from "@shared/lib/dates";
import { peso } from "@shared/lib/pricing";
import { prepareReceipt } from "@shared/lib/image";
import { Modal, iconBtn } from "@shared/components/ui";
import { groupByCourt } from "./Cart";
import PaymentInstructions from "./PaymentInstructions";
import { C, FONT_DISPLAY, primaryBtn } from "@shared/lib/theme";

const ctc: React.CSSProperties = { width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: FONT_DISPLAY, fontSize: 13.5, boxSizing: "border-box", color: C.slate, background: "#fff" };

type Step = "review" | "terms1" | "payment" | "terms2" | "done" | "expired";

export default function Checkout({
  open,
  onClose,
  items,
  courts,
  total,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  items: SelItem[];
  courts: Court[];
  total: number;
  onDone: () => void;
}) {
  const { holdBookings, submitPayment, releaseHolds, paymentMethods, isPeakAt, rateAt, currentCustomer } = useStore();
  const [step, setStep] = useState<Step>("review");
  const [held, setHeld] = useState<Booking[]>([]);
  const [t1, setT1] = useState(false);
  const [t2, setT2] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [payError, setPayError] = useState(false);
  const [takenMsg, setTakenMsg] = useState<string | null>(null);
  const [lastRef, setLastRef] = useState("");
  const [now, setNow] = useState(Date.now());
  // Auto-filled from the signed-in customer's profile; editable in case they
  // want the booking reachable on a different number.
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactErr, setContactErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const heldIds = held.map((b) => b.id);

  // Re-sync whenever the sheet opens or the profile changes.
  useEffect(() => {
    if (!open) return;
    setContactName(currentCustomer.name ?? "");
    setContactPhone(currentCustomer.phone ?? "");
    setContactErr("");
  }, [open, currentCustomer.name, currentCustomer.phone]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresAt = held[0]?.holdExpiresAt ? new Date(held[0].holdExpiresAt).getTime() : null;
  const secLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 600;

  useEffect(() => {
    if ((step === "payment" || step === "terms2") && expiresAt && now >= expiresAt) {
      releaseHolds(heldIds);
      setStep("expired");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, step]);

  function reset() {
    setStep("review");
    setHeld([]);
    setT1(false);
    setT2(false);
    setReceipt("");
    setReceiptImage(null);
    setPayError(false);
    setTakenMsg(null);
  }
  function close() {
    // Keep any live hold instead of releasing it: the held booking now shows in
    // My bookings and greys the calendar, and the customer can finish paying
    // there within the 10-minute window. Clear the cart selection since those
    // slots are held now, not still pending selection.
    const hadHold = held.length > 0;
    reset();
    if (hadHold) onDone();
    else onClose();
  }

  const [busy, setBusy] = useState(false);

  async function primary() {
    if (busy) return;
    if (step === "review") {
      if (!contactName.trim()) return setContactErr("Enter a contact name.");
      if (!contactPhone.trim()) return setContactErr("Enter a contact number.");
      setContactErr("");
      return setStep("terms1");
    }
    if (step === "terms1") {
      if (!t1) return;
      setBusy(true);
      try {
        const created = await holdBookings(items, {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          email: currentCustomer.email || undefined,
        });
        setHeld(created);
        setT2(false);
        setTakenMsg(null);
        setStep("payment");
      } catch (e) {
        // 409 = another customer grabbed one of these slots first; anything
        // else falls back to the generic "hold expired" copy.
        setTakenMsg(
          e instanceof ApiError && e.status === 409 ? e.message : null,
        );
        setStep("expired");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === "payment") {
      if (!receipt) return setPayError(true);
      return setStep("terms2");
    }
    if (step === "terms2") {
      if (!t2) return;
      setBusy(true);
      try {
        await submitPayment(heldIds, receipt, receiptImage ?? undefined);
        setLastRef(held[0]?.ref ?? "");
        setStep("done");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (step === "expired") {
      // A conflict means these slots are gone — return to the calendar to pick
      // again. A plain expiry can just re-hold the same selection.
      if (takenMsg) {
        reset();
        return onDone();
      }
      setT1(false);
      return setStep("terms1");
    }
    if (step === "done") {
      reset();
      return onDone();
    }
  }
  function back() {
    if (step === "terms1") setStep("review");
    else if (step === "payment") {
      releaseHolds(heldIds);
      setHeld([]);
      setStep("terms1");
    } else if (step === "terms2") setStep("payment");
    setPayError(false);
  }

  const groups = groupByCourt(items, courts);
  const hrs = items.length;
  const titles: Record<Step, string> = {
    review: "Review your session",
    terms1: "Terms & conditions",
    payment: "Payment",
    terms2: "Confirm & submit",
    expired: takenMsg ? "Slot no longer available" : "Hold expired",
    done: "All done",
  };
  const stepLabels: Record<Step, string> = {
    review: "Step 1 of 4 · Confirm slots",
    terms1: "Step 2 of 4 · Accept to hold slots",
    payment: "Step 3 of 4 · Pay & upload proof",
    terms2: "Step 4 of 4 · Final confirmation",
    expired: takenMsg ? "Someone else booked it first" : "Your slots were released",
    done: "Pending admin approval",
  };
  const primaryLabel: Record<Step, string> = {
    review: "Confirm booking",
    terms1: "Accept & hold slots",
    payment: "I've paid, continue",
    terms2: "Submit payment",
    expired: takenMsg ? "Back to calendar" : "Hold slots again",
    done: "View my bookings",
  };
  const enabled = step === "terms1" ? t1 : step === "terms2" ? t2 : true;

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");
  let cdBg = "#f0f9ff", cdFg = "#0369a1", cdHint = "Take your time, pay and upload your receipt below.";
  if (secLeft <= 60) { cdBg = "#fff1f2"; cdFg = "#be123c"; cdHint = "Hold ending soon, finish uploading to keep your slots."; }
  else if (secLeft <= 180) { cdBg = "#fffbeb"; cdFg = "#b45309"; cdHint = "A few minutes left to complete your payment."; }

  const showBack = step === "terms1" || step === "payment" || step === "terms2";
  const termsChecked = step === "terms2" ? t2 : t1;

  const footer = step === "done" ? (
    <button onClick={primary} style={{ ...primaryBtn, flex: 1, padding: 14, fontSize: 15 }}>
      {primaryLabel.done}
    </button>
  ) : (
    <>
      {showBack && (
        <button onClick={back} style={{ padding: "14px 18px", border: `1px solid ${C.border}`, borderRadius: 13, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
          Back
        </button>
      )}
      <button
        onClick={primary}
        disabled={!enabled}
        style={{ ...primaryBtn, flex: 1, padding: 14, fontSize: 15, background: enabled ? primaryBtn.background : "#cbd5cf", boxShadow: enabled ? primaryBtn.boxShadow : "none", cursor: enabled ? "pointer" : "not-allowed" }}
      >
        {primaryLabel[step]}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={close} title={titles[step]} subtitle={stepLabels[step]} showClose={step !== "done"} footer={footer}>
      {/* REVIEW */}
      {step === "review" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => (
              <div key={g.court.id} style={{ background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 14, padding: 14 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{g.court.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.slots.map((s) => {
                    const peak = isPeakAt(s.date, s.hour);
                    return (
                      <div key={s.date + s.hour} style={{ display: "flex", alignItems: "center", fontSize: 13.5 }}>
                        <span style={{ color: C.slate }}>{prettyDate(s.date)} · {hourRange(s.hour)}</span>
                        <span style={{ marginLeft: 10, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, color: peak ? C.peakInk : C.offInk, background: peak ? C.peakBg : C.offBg }}>
                          {peak ? "Peak" : "Off-peak"}
                        </span>
                        <span style={{ marginLeft: "auto", fontFamily: FONT_DISPLAY, fontWeight: 600 }}>{peso(rateAt(g.court, s.date, s.hour))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, borderTop: `1px dashed ${C.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 4 }}>Contact details</div>
            <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10 }}>From your profile — change it if the facility should reach someone else.</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Name</div>
                <input value={contactName} onChange={(e) => { setContactName(e.target.value); setContactErr(""); }} style={ctc} />
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Mobile number</div>
                <input value={contactPhone} onChange={(e) => { setContactPhone(e.target.value); setContactErr(""); }} style={ctc} />
              </div>
            </div>
            {contactErr && <div style={{ marginTop: 8, fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>{contactErr}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "18px 0 4px" }}>
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>{hrs} hr{hrs === 1 ? "" : "s"}</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 26 }}>{peso(total)}</span>
          </div>
        </>
      )}

      {/* TERMS 1 & 2 */}
      {(step === "terms1" || step === "terms2") && (
        <>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: step === "terms1" ? "#0369a1" : C.greenD, background: step === "terms1" ? "#f0f9ff" : "#f0fdf4", border: `1px solid ${step === "terms1" ? "#bae6fd" : C.offBorder}`, borderRadius: 11, padding: "10px 12px", marginBottom: 14 }}>
            {step === "terms1" ? "✓ Accepting will hold your slots for 10 minutes while you pay." : "One last confirmation, then your payment goes to an admin for approval."}
          </div>
          <div style={{ height: 180, overflowY: "auto", background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.65, color: "#475569", marginBottom: 14 }} className="thin-scroll">
            <p style={{ margin: "0 0 10px" }}><strong style={{ color: C.ink2 }}>Court booking terms</strong></p>
            <p style={{ margin: "0 0 10px" }}>1. Reserved slots are held for 10 minutes pending payment. Unpaid holds are released automatically and the hours reopen for others.</p>
            <p style={{ margin: "0 0 10px" }}>2. Bookings are confirmed only after an administrator verifies your uploaded payment proof. Until then your status remains pending.</p>
            <p style={{ margin: "0 0 10px" }}>3. Peak pricing applies on weekends and weekday evenings from 5 PM. Rates shown at selection are final for that slot.</p>
            <p style={{ margin: "0 0 10px" }}>4. Cancellations made by an administrator (e.g. maintenance) reopen your hours and are eligible for a full re-book.</p>
            <p style={{ margin: 0 }}>5. Please arrive 10 minutes early. Courts not claimed within 15 minutes of start may be released.</p>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: 12, border: `1px solid ${termsChecked ? C.offBorder : C.border}`, borderRadius: 12, background: "#fff" }}>
            <span
              onClick={() => (step === "terms2" ? setT2((v) => !v) : setT1((v) => !v))}
              style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", border: `1.5px solid ${termsChecked ? C.green : "#cbd5cf"}`, background: termsChecked ? C.green : "#fff" }}
            >
              {termsChecked ? "✓" : ""}
            </span>
            <span style={{ fontSize: 13.5, color: C.slate, lineHeight: 1.5 }}>
              I have read and agree to the court booking terms and conditions.
            </span>
          </label>
        </>
      )}

      {/* PAYMENT */}
      {step === "payment" && (
        <>
          <div style={{ textAlign: "center", padding: 16, borderRadius: 16, color: cdFg, background: cdBg }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.9 }}>Your slots are held for</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 34, letterSpacing: ".02em", lineHeight: 1, marginTop: 4 }}>{mm}:{ss}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 5 }}>{cdHint}</div>
          </div>

          <div style={{ margin: "18px 0 14px" }}>
            <div style={{ fontSize: 13, color: "#475569", marginBottom: 10 }}>Pay <strong style={{ color: C.green }}>{peso(total)}</strong> using any method below, then upload your receipt.</div>
            <PaymentInstructions methods={paymentMethods} />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, marginBottom: 8 }}>
            Upload payment receipt <span style={{ color: "#f43f5e" }}>*</span>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setPayError(false); prepareReceipt(file).then((r) => { setReceipt(r.fileName); setReceiptImage(r.dataUrl); }).catch(() => setPayError(true)); }} />
          {!receipt ? (
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 22, border: "1.5px dashed #cbd5cf", borderRadius: 14, cursor: "pointer", background: "#f7faf9" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: C.offBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, fontSize: 18, fontWeight: 700 }}>↑</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>Tap to upload a screenshot</span>
              <span style={{ fontSize: 11.5, color: C.faint }}>PNG or JPG · required to continue</span>
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
          {payError && <div style={{ marginTop: 10, fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>Please upload your payment receipt before continuing.</div>}
        </>
      )}

      {/* EXPIRED / TAKEN */}
      {step === "expired" && (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.blockBg, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: "#e11d48", fontSize: 24 }}>{takenMsg ? "✕" : "⟲"}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{takenMsg ? "Slot no longer available" : "Hold expired"}</div>
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
            {takenMsg
              ? `${takenMsg} Head back to the calendar to choose a different time.`
              : "Your 10-minute hold ran out, so the slots were released back to the calendar. Your selection is still saved, you can hold them again."}
          </div>
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div style={{ textAlign: "center", padding: "16px 10px" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: C.greenGrad, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 30, boxShadow: "0 12px 26px -10px rgba(22,163,74,.9)" }}>✓</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Payment submitted</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, maxWidth: 320, margin: "0 auto" }}>
            We&apos;ve received your proof for <strong style={{ color: C.ink2 }}>{lastRef}</strong>. An admin will verify it shortly, you&apos;ll see the status update in <strong style={{ color: C.green }}>My bookings</strong>.
          </div>
        </div>
      )}
    </Modal>
  );
}
