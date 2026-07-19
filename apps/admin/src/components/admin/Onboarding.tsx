"use client";

import React, { useMemo, useRef, useState } from "react";
import { useStore } from "@shared/lib/store";
import type { Court, PaymentMethod } from "@shared/lib/types";
import { hourLabel } from "@shared/lib/dates";
import { peso } from "@shared/lib/pricing";
import BrandMark from "@shared/components/BrandMark";
import PaymentMethods from "./PaymentMethods";
import { prepareReceipt } from "@shared/lib/image";
import { FONTS, fontByKey } from "@shared/lib/fonts";
import { deriveSecondary, tint } from "@shared/lib/color";
import { C, FONT_DISPLAY, primaryBtn } from "@shared/lib/theme";

// First-run setup. Blocks the console until the facility is usable — there is
// deliberately no close button and no backdrop dismissal. Nothing is held in
// local state that matters: every step writes straight to the API, so a refresh
// resumes exactly where the admin left off.

type StepId = "brand" | "hours" | "peak" | "payments" | "staff" | "review";

const STEPS: { id: StepId; title: string; hint: string; optional?: boolean; review?: boolean }[] = [
  { id: "brand", title: "Branding", hint: "Name, logo & colours" },
  { id: "hours", title: "Hours, courts & pricing", hint: "When you're open" },
  { id: "peak", title: "Court hours", hint: "Peak vs off-peak" },
  { id: "payments", title: "Payments", hint: "How customers pay" },
  { id: "staff", title: "Staff", hint: "Front desk accounts", optional: true },
  { id: "review", title: "Review", hint: "Check & finish", review: true },
];

// Progress tracks only the steps that actually gate completion.
const REQUIRED_COUNT = STEPS.filter((s) => !s.optional && !s.review).length;

export default function Onboarding() {
  const {
    branding, updateBranding, courts, addCourt, updateCourt, paymentMethods,
    staff, addStaff, bookableHours, completeOnboarding,
  } = useStore();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Each step is satisfied by real data, so progress survives a refresh.
  const dataDone = useMemo(() => ({
    brand: !!branding.appName?.trim(),
    hours: courts.length > 0 && branding.closeHour > branding.openHour,
    peak: (branding.peakHoursWeekday?.length ?? 0) + (branding.peakHoursWeekend?.length ?? 0) > 0,
    payments: paymentMethods.length > 0,
    staff: true,
  }), [branding, courts.length, paymentMethods.length]);

  // The review step isn't data — it's satisfied once everything else is.
  const requiredLeft = STEPS.filter(
    (s) => !s.optional && !s.review && !dataDone[s.id as keyof typeof dataDone],
  ).length;
  const canFinish = requiredLeft === 0;
  const doneMap = { ...dataDone, review: canFinish } as Record<StepId, boolean>;
  const cur = STEPS[step];

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await completeOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(6,20,12,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 720, maxHeight: "92vh", background: "#fff", borderRadius: 20, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 70px -20px rgba(2,20,10,.6)" }}>
        {/* Header — no close button, on purpose */}
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border3}` }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>Finish setting up your facility</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
            The console stays locked until this is done. Your progress is saved as you go — you can close the tab and come back.
          </div>
          <div style={{ marginTop: 12, height: 4, background: "#eef2f0", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(((REQUIRED_COUNT - requiredLeft) / REQUIRED_COUNT) * 100)}%`, background: C.green, transition: "width .2s ease" }} />
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Step rail */}
          <div style={{ width: 190, flexShrink: 0, borderRight: `1px solid ${C.border3}`, padding: "10px 8px", overflowY: "auto" }} className="thin-scroll">
            {STEPS.map((s, i) => {
              const on = i === step;
              const dn = doneMap[s.id] && !(s.optional && s.id === "staff" && staff.length === 0);
              return (
                <button key={s.id} onClick={() => setStep(i)} style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 11, border: "none", cursor: "pointer", background: on ? C.offBg : "transparent", marginBottom: 2 }}>
                  <span style={{ width: 19, height: 19, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, fontFamily: FONT_DISPLAY, background: dn ? C.green : on ? "#fff" : "#eef2f0", color: dn ? "#fff" : C.muted, border: on && !dn ? `1px solid ${C.border}` : "none" }}>{dn ? "✓" : i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: on ? C.greenD : C.slate }}>{s.title}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.faint, marginTop: 1 }}>{s.optional ? "Optional" : s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step body — scrollable */}
          <div style={{ flex: 1, minWidth: 0, padding: "18px 22px", overflowY: "auto" }} className="thin-scroll">
            {cur.id === "brand" && <BrandStep branding={branding} updateBranding={updateBranding} />}
            {cur.id === "hours" && <HoursStep branding={branding} updateBranding={updateBranding} courts={courts} addCourt={addCourt} updateCourt={updateCourt} />}
            {cur.id === "peak" && <PeakStep branding={branding} updateBranding={updateBranding} hours={bookableHours} />}
            {cur.id === "payments" && <PaymentsStep />}
            {cur.id === "staff" && <StaffStep staff={staff} addStaff={addStaff} />}
            {cur.id === "review" && (
              <ReviewStep
                branding={branding} courts={courts} methods={paymentMethods} staff={staff}
                dataDone={dataDone} goTo={setStep}
              />
            )}
          </div>
        </div>

        <div style={{ padding: "12px 22px", borderTop: `1px solid ${C.border3}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: canFinish ? C.green : C.faint, fontWeight: 600 }}>
            {canFinish ? "All required steps done" : `${requiredLeft} required step${requiredLeft > 1 ? "s" : ""} left`}
          </span>
          {error && <span style={{ fontSize: 12, color: "#e11d48", fontWeight: 500 }}>{error}</span>}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} style={{ padding: "11px 16px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13.5, cursor: step === 0 ? "not-allowed" : "pointer", opacity: step === 0 ? 0.5 : 1 }}>Back</button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep((s) => s + 1)} style={{ ...primaryBtn, padding: "11px 20px", fontSize: 13.5, boxShadow: "none" }}>Next</button>
            ) : (
              <button onClick={finish} disabled={!canFinish || busy} style={{ ...primaryBtn, padding: "11px 20px", fontSize: 13.5, boxShadow: "none", background: canFinish && !busy ? primaryBtn.background : "#cbd5cf", cursor: canFinish && !busy ? "pointer" : "not-allowed" }}>
                {busy ? "Finishing…" : "Finish setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- steps ---------- */

function BrandStep({ branding, updateBranding }: any) {
  const [name, setName] = useState(branding.appName ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");

  async function pickLogo(file: File) {
    setErr("");
    try {
      const { dataUrl } = await prepareReceipt(file);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth !== img.naturalHeight) {
          setErr(`Logo must be square — that one is ${img.naturalWidth}×${img.naturalHeight}.`);
          return;
        }
        updateBranding({ logoUrl: dataUrl });
      };
      img.src = dataUrl;
    } catch {
      setErr("Could not read that image.");
    }
  }

  return (
    <>
      <H>Branding</H>
      <P>Your name, logo and colours. These appear on the customer app, the landing page and this console.</P>
      <L>Facility name</L>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => updateBranding({ appName: name.trim() || "AfterHours" })} placeholder="e.g. CourtHub" style={fld} />

      <L style={{ marginTop: 14 }}>Logo</L>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, border: `1px solid ${C.border}`, background: branding.logoUrl ? "#fff" : C.greenGrad, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
          {branding.logoUrl ? <img src={branding.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BrandMark size={22} />}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pickLogo(f); }} />
          <button onClick={() => fileRef.current?.click()} style={btn}>{branding.logoUrl ? "Change logo" : "Upload square logo"}</button>
          <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>Square (1:1), PNG or JPEG.</div>
          {err && <div style={{ fontSize: 12, color: "#e11d48", marginTop: 5 }}>{err}</div>}
        </div>
      </div>

      <L style={{ marginTop: 16 }}>Font</L>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
        {FONTS.map((f) => {
          const on = branding.fontFamily === f.key;
          return (
            <button key={f.key} onClick={() => updateBranding({ fontFamily: f.key })} style={{ textAlign: "left", padding: "9px 11px", borderRadius: 11, cursor: "pointer", border: `1px solid ${on ? C.green : C.border}`, background: on ? C.offBg : "#fff" }}>
              <span style={{ display: "block", fontFamily: f.display, fontWeight: 700, fontSize: 14, color: on ? C.greenD : C.ink2 }}>{f.label}</span>
              <span style={{ display: "block", fontSize: 11, color: C.faint, marginTop: 1 }}>{f.note}</span>
            </button>
          );
        })}
      </div>

      <L style={{ marginTop: 16 }}>Brand colour</L>
      <input
        type="color"
        value={branding.primary}
        onChange={(e) => updateBranding({ primary: e.target.value, secondary: deriveSecondary(e.target.value) })}
        style={{ ...fld, height: 40, padding: 4 }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "9px 11px", background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 11 }}>
        <span style={{ fontSize: 11.5, color: C.muted }}>Derived</span>
        <Swatch c={branding.primary} />
        <Swatch c={deriveSecondary(branding.primary)} />
        <Swatch c={tint(branding.primary)} />
        <span style={{ fontSize: 11, color: C.faint, marginLeft: "auto" }}>The rest of the palette follows your brand colour</span>
      </div>
    </>
  );
}

// A court in the onboarding list: read-only until "Edit", then the same four
// fields the add form uses, saving through updateCourt (which PATCHes /courts).
function CourtRow({ court, updateCourt }: { court: Court; updateCourt: (c: Court) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(court.name);
  const [surface, setSurface] = useState(court.surface);
  const [peak, setPeak] = useState(court.peakRate);
  const [off, setOff] = useState(court.offPeakRate);

  function start() {
    setName(court.name); setSurface(court.surface);
    setPeak(court.peakRate); setOff(court.offPeakRate);
    setEditing(true);
  }
  function save() {
    if (!name.trim()) return;
    updateCourt({ ...court, name: name.trim(), surface: surface.trim() || "Court", peakRate: peak, offPeakRate: off });
    setEditing(false);
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${C.border2}`, borderRadius: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{court.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{court.surface} · Peak {peso(court.peakRate)} · Off-peak {peso(court.offPeakRate)}</div>
        </div>
        <button onClick={start} style={{ fontSize: 12.5, fontWeight: 600, color: C.green, background: "none", border: "none", cursor: "pointer" }}>Edit</button>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.green}`, borderRadius: 11, padding: 12 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}><L>Name</L><input value={name} onChange={(e) => setName(e.target.value)} style={fld} /></div>
        <div style={{ flex: 1 }}><L>Surface</L><input value={surface} onChange={(e) => setSurface(e.target.value)} style={fld} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><L>Peak / hr</L><input type="number" value={peak} onChange={(e) => setPeak(Number(e.target.value))} style={fld} /></div>
        <div style={{ flex: 1 }}><L>Off-peak / hr</L><input type="number" value={off} onChange={(e) => setOff(Number(e.target.value))} style={fld} /></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={!name.trim()} style={{ ...primaryBtn, flex: 1, padding: 10, fontSize: 13, boxShadow: "none", background: name.trim() ? primaryBtn.background : "#cbd5cf", cursor: name.trim() ? "pointer" : "not-allowed" }}>Save</button>
        <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 10, border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}

function HoursStep({ branding, updateBranding, courts, addCourt, updateCourt }: any) {
  const [n, setN] = useState("");
  const [surface, setSurface] = useState("Cushioned acrylic");
  const [peak, setPeak] = useState(700);
  const [off, setOff] = useState(450);
  const allDay = branding.openHour === 0 && branding.closeHour === 24;

  return (
    <>
      <H>Opening hours, courts &amp; pricing</H>
      <P>When you&apos;re open, and the courts customers can book. At least one court is required.</P>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => updateBranding({ openHour: 6, closeHour: 22 })} style={{ ...btn, borderColor: allDay ? C.border : C.green, color: allDay ? C.slate : C.greenD }}>Specific hours</button>
        <button onClick={() => updateBranding({ openHour: 0, closeHour: 24 })} style={{ ...btn, borderColor: allDay ? C.green : C.border, color: allDay ? C.greenD : C.slate }}>Open 24 hours</button>
      </div>
      {!allDay && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <L>Opens</L>
            <select value={branding.openHour} onChange={(e) => updateBranding({ openHour: Number(e.target.value) })} style={fld}>
              {Array.from({ length: 24 }, (_, i) => i).filter((h) => h < branding.closeHour).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <L>Closes</L>
            <select value={branding.closeHour} onChange={(e) => updateBranding({ closeHour: Number(e.target.value) })} style={fld}>
              {Array.from({ length: 24 }, (_, i) => i + 1).filter((h) => h > branding.openHour).map((h) => <option key={h} value={h}>{h === 24 ? "12 AM" : hourLabel(h)}</option>)}
            </select>
          </div>
        </div>
      )}

      {courts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {courts.map((c: Court) => (
            <CourtRow key={c.id} court={c} updateCourt={updateCourt} />
          ))}
        </div>
      )}

      <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Add a court</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}><L>Name</L><input value={n} onChange={(e) => setN(e.target.value)} placeholder="Center Court" style={fld} /></div>
          <div style={{ flex: 1 }}><L>Surface</L><input value={surface} onChange={(e) => setSurface(e.target.value)} style={fld} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}><L>Peak / hr</L><input type="number" value={peak} onChange={(e) => setPeak(Number(e.target.value))} style={fld} /></div>
          <div style={{ flex: 1 }}><L>Off-peak / hr</L><input type="number" value={off} onChange={(e) => setOff(Number(e.target.value))} style={fld} /></div>
        </div>
        <button
          onClick={() => { if (!n.trim()) return; addCourt({ name: n.trim(), surface: surface.trim() || "Court", peakRate: peak, offPeakRate: off, status: "active" }); setN(""); }}
          disabled={!n.trim()}
          style={{ ...primaryBtn, width: "100%", padding: 11, fontSize: 13.5, boxShadow: "none", background: n.trim() ? primaryBtn.background : "#cbd5cf", cursor: n.trim() ? "pointer" : "not-allowed" }}
        >Add court</button>
      </div>
    </>
  );
}

function PeakStep({ branding, updateBranding, hours }: any) {
  function toggle(which: "weekday" | "weekend", h: number) {
    const key = which === "weekday" ? "peakHoursWeekday" : "peakHoursWeekend";
    const cur: number[] = branding[key] ?? [];
    const next = cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h].sort((a, b) => a - b);
    updateBranding({ [key]: next });
  }
  const Row = ({ label, which }: { label: string; which: "weekday" | "weekend" }) => {
    const list: number[] = branding[which === "weekday" ? "peakHoursWeekday" : "peakHoursWeekend"] ?? [];
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 11.5, color: C.peakInk, marginLeft: "auto" }}>{list.length} peak hr{list.length === 1 ? "" : "s"}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {hours.map((h: number) => {
            const on = list.includes(h);
            return <button key={h} onClick={() => toggle(which, h)} style={{ minWidth: 56, padding: "7px 5px", borderRadius: 8, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11.5, cursor: "pointer", border: `1px solid ${on ? C.peakBorder : C.offBorder}`, background: on ? C.peakBg : C.offBg, color: on ? C.peakInkD : C.offInkD }}>{hourLabel(h)}</button>;
          })}
        </div>
      </div>
    );
  };
  return (
    <>
      <H>Court hours</H>
      <P>Which hours bill at each court&apos;s peak rate. Amber is peak, green is off-peak — tap to switch.</P>
      <Row label="Weekdays" which="weekday" />
      <Row label="Weekends" which="weekend" />
    </>
  );
}

function reviewDetail(m: PaymentMethod): string {
  if (m.type === "gcash" || m.type === "maya") return m.phone || "—";
  if (m.type === "bank") return [m.accountNumber, m.accountName].filter(Boolean).join(" · ") || "—";
  if (m.type === "cash") return "Pay at facility";
  return "Accepted";
}

function PaymentsStep() {
  return (
    <>
      <H>Payments</H>
      <P>How customers pay you. At least one method is required — customers pick one at checkout, see its details, and upload their receipt.</P>
      <PaymentMethods />
    </>
  );
}

type PendingStaff = { name: string; email: string; access: "staff" };

function StaffStep({ staff, addStaff }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Staged locally and only written to the DB on "Create". This is the "list
  // them first before submitting" flow — nothing hits /staff until submit.
  const [pending, setPending] = useState<PendingStaff[]>([]);
  const [created, setCreated] = useState<{ name: string; pw: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && email.trim();

  // Guard duplicate emails across both what's staged and what already exists.
  const emailTaken = (e: string) =>
    pending.some((p) => p.email.toLowerCase() === e.toLowerCase()) ||
    staff.some((s: any) => s.email.toLowerCase() === e.toLowerCase());

  function stage() {
    const e = email.trim();
    if (!valid || emailTaken(e)) return;
    setPending((p) => [...p, { name: name.trim(), email: e, access: "staff" }]);
    setName(""); setEmail("");
  }

  async function createAll() {
    setBusy(true);
    const results: { name: string; pw: string }[] = [];
    for (const s of pending) {
      try {
        const c = await addStaff(s);
        results.push({ name: c.name, pw: c.tempPassword });
      } catch { /* store toasts the error; skip this one */ }
    }
    setCreated((prev) => [...prev, ...results]);
    setPending([]);
    setBusy(false);
  }

  return (
    <>
      <H>Staff <span style={{ fontSize: 12, fontWeight: 500, color: C.faint }}>· optional</span></H>
      <P>Front-desk accounts. Add them to the list, review, then create them all at once. You can skip this and add staff later from User management.</P>

      {/* Already created this session or earlier. */}
      {staff.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {staff.map((s: any) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${C.border2}`, borderRadius: 11 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.offInkD, background: C.offBg, padding: "2px 8px", borderRadius: 999 }}>Created</span>
            </div>
          ))}
        </div>
      )}

      {/* Staged, not yet written to the DB. */}
      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {pending.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: `1px solid ${C.border2}`, borderRadius: 11 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.peakInk, background: C.peakBg, padding: "2px 8px", borderRadius: 999 }}>Pending</span>
              <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} style={{ fontSize: 12.5, fontWeight: 600, color: C.blockInk2, background: "none", border: "none", cursor: "pointer" }}>Remove</button>
            </div>
          ))}
          <button
            onClick={createAll}
            disabled={busy}
            style={{ ...primaryBtn, width: "100%", padding: 11, fontSize: 13.5, boxShadow: "none", marginTop: 2, opacity: busy ? 0.7 : 1, cursor: busy ? "not-allowed" : "pointer" }}
          >{busy ? "Creating…" : `Create ${pending.length} account${pending.length > 1 ? "s" : ""}`}</button>
        </div>
      )}

      {created.length > 0 && (
        <div style={{ background: C.offBg, border: `1px solid ${C.offBorder}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.offInkD, marginBottom: 6 }}>Temporary passwords — shown once, copy them now</div>
          {created.map((c, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", borderTop: i ? `1px solid ${C.offBorder}` : "none" }}>
              <span style={{ fontSize: 12.5, color: C.slate }}>{c.name}</span>
              <code style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{c.pw}</code>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}><L>Name</L><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Cruz" style={fld} /></div>
        <div style={{ flex: 1 }}><L>Email</L><input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") stage(); }} placeholder="name@facility.com" style={fld} /></div>
      </div>
      {email.trim() && emailTaken(email.trim()) && (
        <div style={{ fontSize: 12, color: "#e11d48", marginBottom: 8 }}>That email is already on the list.</div>
      )}
      <button
        onClick={stage}
        disabled={!valid || emailTaken(email.trim())}
        style={{ ...primaryBtn, width: "100%", padding: 11, fontSize: 13.5, boxShadow: "none", background: valid && !emailTaken(email.trim()) ? primaryBtn.background : "#cbd5cf", cursor: valid && !emailTaken(email.trim()) ? "pointer" : "not-allowed" }}
      >Add to list</button>
    </>
  );
}

// Final check before committing. Everything shown here is already saved — this
// confirms what goes live, and links back to any step that still needs work.
function ReviewStep({ branding, courts, methods, staff, dataDone, goTo }: any) {
  const allDay = branding.openHour === 0 && branding.closeHour === 24;
  const hoursLabel = allDay
    ? "Open 24 hours"
    : `${hourLabel(branding.openHour)} to ${branding.closeHour === 24 ? "12 AM" : hourLabel(branding.closeHour)}`;

  return (
    <>
      <H>Review</H>
      <P>Everything below is already saved. Check it over, then finish setup to unlock the console.</P>

      <Group n={0} title="Branding" ok={dataDone.brand} goTo={goTo}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${C.border}`, background: branding.logoUrl ? "#fff" : C.greenGrad, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {branding.logoUrl ? <img src={branding.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <BrandMark size={14} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{branding.appName || "—"}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{branding.logoUrl ? "Custom logo" : "Default logo"}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <Swatch c={branding.primary} />
            <Swatch c={deriveSecondary(branding.primary)} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <Line k="Font" v={fontByKey(branding.fontFamily).label} />
        </div>
      </Group>

      <Group n={1} title="Opening hours & courts" ok={dataDone.hours} goTo={goTo}>
        <Line k="Open" v={hoursLabel} />
        {courts.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#e11d48" }}>No courts added yet.</div>
        ) : courts.map((c: any) => (
          <Line key={c.id} k={c.name} v={`${peso(c.peakRate)} peak · ${peso(c.offPeakRate)} off-peak`} />
        ))}
      </Group>

      <Group n={2} title="Court hours" ok={dataDone.peak} goTo={goTo}>
        <Line k="Weekday peak" v={fmtHours(branding.peakHoursWeekday)} />
        <Line k="Weekend peak" v={fmtHours(branding.peakHoursWeekend)} />
      </Group>

      <Group n={3} title="Payments" ok={dataDone.payments} goTo={goTo}>
        {methods.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#e11d48" }}>No payment method added yet.</div>
        ) : methods.map((m: PaymentMethod) => (
          <Line key={m.id} k={m.label} v={reviewDetail(m)} />
        ))}
      </Group>

      <Group n={4} title="Staff" ok optional goTo={goTo}>
        {staff.length === 0
          ? <div style={{ fontSize: 12.5, color: C.faint }}>None yet — you can add them later from User management.</div>
          : staff.map((s: any) => <Line key={s.id} k={s.name} v={s.email} />)}
      </Group>
    </>
  );
}

function fmtHours(list?: number[]) {
  if (!list?.length) return "None — all off-peak";
  return `${list.length} hr${list.length === 1 ? "" : "s"} · ${hourLabel(list[0])}–${hourLabel(list[list.length - 1] + 1)}`;
}

function Swatch({ c }: { c: string }) {
  return <span title={c} style={{ width: 22, height: 22, borderRadius: 7, background: c, border: `1px solid ${C.border}`, display: "inline-block" }} />;
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 12.5, padding: "2px 0" }}>
      <span style={{ color: C.muted, flexShrink: 0 }}>{k}</span>
      <span style={{ marginLeft: "auto", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

function Group({ n, title, ok, optional, goTo, children }: any) {
  return (
    <div style={{ border: `1px solid ${ok ? C.border2 : C.blockBorder}`, background: ok ? "#fff" : C.blockBg, borderRadius: 12, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: FONT_DISPLAY }}>{title}</span>
        {!ok && <span style={{ fontSize: 11, fontWeight: 700, color: C.blockInk2 }}>Incomplete</span>}
        {optional && <span style={{ fontSize: 11, color: C.faint }}>Optional</span>}
        <button onClick={() => goTo(n)} style={{ marginLeft: "auto", fontSize: 12, color: C.green, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>
      </div>
      {children}
    </div>
  );
}

/* ---------- bits ---------- */

const fld: React.CSSProperties = { width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: FONT_DISPLAY, fontSize: 13.5, boxSizing: "border-box", color: C.slate, background: "#fff" };
const btn: React.CSSProperties = { padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, cursor: "pointer" };

function H({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{children}</div>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: C.muted, margin: "0 0 14px", lineHeight: 1.55 }}>{children}</p>;
}
function L({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 5, ...style }}>{children}</div>;
}
