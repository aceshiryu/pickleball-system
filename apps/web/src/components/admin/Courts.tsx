"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import type { Court } from "@/lib/types";
import { DEFAULT_CLOSE_HOUR, DEFAULT_OPEN_HOUR, peso } from "@/lib/pricing";
import { hourLabel } from "@/lib/dates";
import { Modal } from "../ui";
import { useConfirm } from "../Confirm";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

type Draft = { id?: string; name: string; surface: string; peakRate: number; offPeakRate: number; isNew?: boolean };

const NEW_COURT: Draft = { isNew: true, name: "New Court", surface: "Cushioned acrylic", peakRate: 600, offPeakRate: 400 };

export default function Courts() {
  const { courts, addCourt, updateCourt, toggleMaintenance, access } = useStore();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const canEdit = access === "admin";
  const valid = !!draft && draft.name.trim().length > 0 && draft.surface.trim().length > 0;

  function save() {
    if (!draft || !valid) return;
    if (draft.isNew) {
      addCourt({ name: draft.name.trim(), surface: draft.surface.trim(), peakRate: Number(draft.peakRate), offPeakRate: Number(draft.offPeakRate), status: "active" });
    } else {
      const current = courts.find((c) => c.id === draft.id);
      if (!current) return;
      updateCourt({ id: draft.id!, name: draft.name.trim(), surface: draft.surface.trim(), peakRate: Number(draft.peakRate), offPeakRate: Number(draft.offPeakRate), status: current.status });
    }
    setDraft(null);
  }

  return (
    <div>
      <OpeningHours canEdit={canEdit} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {courts.map((c) => {
          const maint = c.status === "maintenance";
          return (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${maint ? C.peakBorder : C.border}`, borderRadius: 18, padding: 18, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: C.muted2, marginTop: 2 }}>{c.surface}</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, color: maint ? C.peakInk : C.offInkD, background: maint ? C.peakBg : C.offBg }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: maint ? "#f59e0b" : C.green }} />{maint ? "Under maintenance" : "Active"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1, background: C.peakBg, border: `1px solid ${C.peakBorder}`, borderRadius: 12, padding: 11 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.peakInk, textTransform: "uppercase", letterSpacing: ".03em" }}>Peak / hr</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.peakInkD, marginTop: 3 }}>{peso(c.peakRate)}</div>
                </div>
                <div style={{ flex: 1, background: C.offBg, border: `1px solid ${C.offBorder}`, borderRadius: 12, padding: 11 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.offInk, textTransform: "uppercase", letterSpacing: ".03em" }}>Off-peak / hr</div>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: C.offInkD, marginTop: 3 }}>{peso(c.offPeakRate)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {canEdit && (
                  <button onClick={() => setDraft({ id: c.id, name: c.name, surface: c.surface, peakRate: c.peakRate, offPeakRate: c.offPeakRate })} style={{ flex: 1, padding: 10, borderRadius: 11, cursor: "pointer", fontWeight: 600, fontSize: 12.5, border: `1px solid ${C.border}`, background: "#fff", color: C.slate }}>Edit details</button>
                )}
                <button onClick={async () => { if (await confirm({ title: maint ? "End maintenance?" : "Set maintenance?", message: maint ? `${c.name} will be bookable again.` : `${c.name} will be closed for booking until maintenance ends.`, confirmLabel: maint ? "End maintenance" : "Set maintenance", danger: !maint })) toggleMaintenance(c.id); }} style={{ flex: 1, padding: 10, borderRadius: 11, cursor: "pointer", fontWeight: 600, fontSize: 12.5, border: `1px solid ${maint ? C.offBorder : C.peakBorder}`, background: maint ? C.offBg : C.peakBg, color: maint ? C.offInkD : C.peakInk }}>{maint ? "End maintenance" : "Set maintenance"}</button>
              </div>
            </div>
          );
        })}

        {canEdit && (
          <button onClick={() => setDraft({ ...NEW_COURT })} style={{ minHeight: 200, border: "1.5px dashed #cbd5cf", borderRadius: 18, background: "#fff", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.muted }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.offBg, display: "flex", alignItems: "center", justifyContent: "center", color: C.green, fontSize: 22, fontWeight: 700 }}>+</div>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>Add a court</span>
          </button>
        )}
      </div>

      {courts.length === 0 && !canEdit && (
        <div style={{ textAlign: "center", padding: "56px 20px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>No courts yet</div>
          <div style={{ fontSize: 13.5, color: C.faint, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            No courts have been set up yet. An admin can add them here.
          </div>
        </div>
      )}

      {!canEdit && courts.length > 0 && (
        <p style={{ fontSize: 12.5, color: C.faint, marginTop: 14 }}>You have view access to court rates. Staff can set courts to maintenance, but only admins can add or edit court details.</p>
      )}

      <PeakHours canEdit={canEdit} />

      <Modal open={!!draft} onClose={() => setDraft(null)} maxWidth={420} title={draft?.isNew ? "Add a court" : "Edit court"}
        footer={<>
          <button onClick={() => setDraft(null)} style={{ flex: 1, padding: 13, border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
          <button onClick={save} disabled={!valid} style={{ ...primaryBtn, flex: 2, padding: 13, fontSize: 14, boxShadow: "none", background: valid ? primaryBtn.background : "#cbd5cf", cursor: valid ? "pointer" : "not-allowed" }}>{draft?.isNew ? "Add court" : "Save court"}</button>
        </>}
      >
        {draft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Court name"><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={txt} /></Field>
            <Field label="Surface"><input value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} style={txt} /></Field>
            <div style={{ display: "flex", gap: 12 }}>
              <Field label="Peak rate / hr (₱)" color={C.peakInk}><input type="number" value={draft.peakRate} onChange={(e) => setDraft({ ...draft, peakRate: Number(e.target.value) })} style={{ ...txt, border: `1px solid ${C.peakBorder}`, background: C.peakBg, color: C.peakInkD, fontFamily: FONT_DISPLAY, fontWeight: 600 }} /></Field>
              <Field label="Off-peak / hr (₱)" color={C.offInk}><input type="number" value={draft.offPeakRate} onChange={(e) => setDraft({ ...draft, offPeakRate: Number(e.target.value) })} style={{ ...txt, border: `1px solid ${C.offBorder}`, background: C.offBg, color: C.offInkD, fontFamily: FONT_DISPLAY, fontWeight: 600 }} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// When the facility opens and closes. Drives which hours customers can book,
// and the peak-hours grid below. "Open 24 hours" is simply 0 to 24.
function OpeningHours({ canEdit }: { canEdit: boolean }) {
  const { branding, updateBranding } = useStore();
  const openHour = branding.openHour ?? DEFAULT_OPEN_HOUR;
  const closeHour = branding.closeHour ?? DEFAULT_CLOSE_HOUR;
  const allDay = openHour === 0 && closeHour === 24;

  // closeHour is exclusive, so it can read 24 ("12 AM" next day).
  const closeLabel = (h: number) => (h === 24 ? "12 AM" : hourLabel(h));
  const OPEN_CHOICES = Array.from({ length: 24 }, (_, i) => i); // 0..23
  const CLOSE_CHOICES = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24

  function setMode(whole: boolean) {
    if (!canEdit) return;
    updateBranding(
      whole
        ? { openHour: 0, closeHour: 24 }
        : { openHour: DEFAULT_OPEN_HOUR, closeHour: DEFAULT_CLOSE_HOUR },
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 16 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Opening hours</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.55 }}>
        Applies to every court. Customers can only book hours inside this window
        {canEdit && <>, and it sets which hours appear below</>}.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { whole: false, label: "Specific hours" },
          { whole: true, label: "Open 24 hours" },
        ].map((m) => {
          const on = m.whole === allDay;
          return (
            <button
              key={m.label}
              onClick={() => setMode(m.whole)}
              disabled={!canEdit}
              style={{ padding: "9px 15px", borderRadius: 11, cursor: canEdit ? "pointer" : "default", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, border: `1px solid ${on ? C.green : C.border}`, background: on ? "#f0fdf4" : "#fff", color: on ? C.greenD : C.slate, opacity: canEdit ? 1 : 0.75 }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {allDay ? (
        <div style={{ fontSize: 13, color: C.offInkD, background: C.offBg, border: `1px solid ${C.offBorder}`, borderRadius: 12, padding: "11px 13px" }}>
          Open all day — every hour from 12 AM to 12 AM is bookable.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Opens">
            <select
              value={openHour}
              disabled={!canEdit}
              onChange={(e) => updateBranding({ openHour: Number(e.target.value) })}
              style={txt}
            >
              {OPEN_CHOICES.filter((h) => h < closeHour).map((h) => (
                <option key={h} value={h}>{hourLabel(h)}</option>
              ))}
            </select>
          </Field>
          <Field label="Closes">
            <select
              value={closeHour}
              disabled={!canEdit}
              onChange={(e) => updateBranding({ closeHour: Number(e.target.value) })}
              style={txt}
            >
              {CLOSE_CHOICES.filter((h) => h > openHour).map((h) => (
                <option key={h} value={h}>{closeLabel(h)}</option>
              ))}
            </select>
          </Field>
          <div style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: C.faint, paddingBottom: 12 }}>
            Last bookable slot starts {hourLabel(closeHour - 1)}.
          </div>
        </div>
      )}
      {!canEdit && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 12 }}>Only admins can change opening hours.</div>}
    </div>
  );
}

// Facility-wide peak hours. Toggling an hour reprices every slot that is not
// booked yet; holds and bookings keep the rate frozen at booking time.
function PeakHours({ canEdit }: { canEdit: boolean }) {
  const { branding, updateBranding, bookableHours } = useStore();
  const weekday = branding.peakHoursWeekday ?? [];
  const weekend = branding.peakHoursWeekend ?? [];

  function toggle(which: "weekday" | "weekend", hour: number) {
    if (!canEdit) return;
    const current = which === "weekday" ? weekday : weekend;
    const next = current.includes(hour)
      ? current.filter((h) => h !== hour)
      : [...current, hour].sort((a, b) => a - b);
    updateBranding(
      which === "weekday" ? { peakHoursWeekday: next } : { peakHoursWeekend: next },
    );
  }

  function Row({ label, hint, which, hours }: { label: string; hint: string; which: "weekday" | "weekend"; hours: number[] }) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: C.faint }}>{hint}</div>
          <div style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: C.peakInk }}>{hours.length} peak hr{hours.length === 1 ? "" : "s"}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {bookableHours.map((h) => {
            const on = hours.includes(h);
            return (
              <button
                key={h}
                onClick={() => toggle(which, h)}
                disabled={!canEdit}
                title={`${hourLabel(h)} — ${on ? "peak" : "off-peak"}${canEdit ? ", click to switch" : ""}`}
                style={{
                  minWidth: 62, padding: "8px 6px", borderRadius: 9, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12,
                  cursor: canEdit ? "pointer" : "default",
                  border: `1px solid ${on ? C.peakBorder : C.offBorder}`,
                  background: on ? C.peakBg : C.offBg,
                  color: on ? C.peakInkD : C.offInkD,
                  opacity: canEdit ? 1 : 0.75,
                }}
              >
                {hourLabel(h)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginTop: 16 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Peak hours</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.55 }}>
        Applies to every court, one hour at a time. Amber hours bill at each court&apos;s peak rate, green at its off-peak rate.
        {canEdit && <> Changes reprice slots that aren&apos;t booked yet — existing holds and bookings keep the price they were made at.</>}
      </div>
      <Row label="Weekdays" hint="Mon to Fri" which="weekday" hours={weekday} />
      <Row label="Weekends" hint="Sat & Sun" which="weekend" hours={weekend} />
      {!canEdit && <div style={{ fontSize: 12.5, color: C.faint }}>Only admins can change peak hours.</div>}
    </div>
  );
}

const txt: React.CSSProperties = { width: "100%", padding: 11, border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, boxSizing: "border-box", color: C.slate };

function Field({ label, color, children }: { label: string; color?: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: color ?? C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
