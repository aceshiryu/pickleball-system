"use client";

import React, { useState } from "react";
import { useStore } from "@shared/lib/store";
import type { OverrideReason, OverrideScope } from "@shared/lib/types";
import { addDays, hourLabel, prettyDate, startOfWeek, todayISO } from "@shared/lib/dates";
import { C, FONT_DISPLAY } from "@shared/lib/theme";
import { useConfirm } from "@shared/components/Confirm";

const REASON_LABEL: Record<OverrideReason, string> = { maintenance: "Maintenance", holiday: "Holiday", private_event: "Private event", other: "Other" };
const REASONS: OverrideReason[] = ["maintenance", "holiday", "private_event", "other"];

export default function Blackouts({ isMobile }: { isMobile: boolean }) {
  const { overrides, courts, addOverride, removeOverride, bookableHours: HRS } = useStore();
  const confirm = useConfirm();
  const [reason, setReason] = useState<OverrideReason>("maintenance");
  const [courtId, setCourtId] = useState("all");
  const [scope, setScope] = useState<OverrideScope>("date");
  const [date, setDate] = useState(() => addDays(todayISO(), 1));
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(12);

  const courtName = (id: string) => (id === "all" ? "All courts" : courts.find((c) => c.id === id)?.name ?? id);
  const scopeLabel = (o: { scope: OverrideScope; startHour?: number; endHour?: number }) =>
    o.scope === "date" ? "Whole day" : o.scope === "week" ? "Whole week" : `${hourLabel(o.startHour ?? 0)} to ${hourLabel(o.endHour ?? 0)}`;

  async function add() {
    if (await confirm({ title: "Add this block?", message: "Customers will not be able to book the selected times.", confirmLabel: "Add block" })) {
      addOverride({ label: REASON_LABEL[reason], reason, courtId, scope, date, startHour: scope === "hours" ? startHour : undefined, endHour: scope === "hours" ? endHour : undefined });
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Active blackouts</div>
        {overrides.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {overrides.map((b) => (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: `1px solid ${C.border2}`, borderRadius: 14 }}>
                <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 11, background: C.blockBg, color: "#e11d48", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⃠</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink2 }}>{b.label}</div>
                  <div style={{ fontSize: 12.5, color: C.muted2 }}>{courtName(b.courtId)} · {prettyDate(b.scope === "week" ? startOfWeek(b.date) : b.date)} · {scopeLabel(b)}</div>
                </div>
                <button onClick={async () => { if (await confirm({ title: "Remove this block?", message: `${b.label} will be lifted and those times reopened for booking.`, confirmLabel: "Remove", danger: true })) removeOverride(b.id); }} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", color: C.faint, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: C.faint, padding: "24px 0", textAlign: "center" }}>No active blackouts.</div>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Add a block</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Field label="Reason">
            <select value={reason} onChange={(e) => setReason(e.target.value as OverrideReason)} style={sel}>
              {REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Court">
              <select value={courtId} onChange={(e) => setCourtId(e.target.value)} style={sel}>
                <option value="all">All courts</option>
                {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Scope">
              <select value={scope} onChange={(e) => setScope(e.target.value as OverrideScope)} style={sel}>
                <option value="date">Whole day</option>
                <option value="hours">Specific hours</option>
                <option value="week">Whole week</option>
              </select>
            </Field>
          </div>
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...sel, boxSizing: "border-box" }} />
          </Field>
          {scope === "hours" && (
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="From"><select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} style={sel}>{HRS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
              <Field label="To"><select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))} style={sel}>{HRS.filter((h) => h > startHour).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></Field>
            </div>
          )}
          <button onClick={add} style={{ marginTop: 4, width: "100%", padding: 13, border: "none", borderRadius: 12, background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Add blackout</button>
        </div>
      </div>
    </div>
  );
}

const sel: React.CSSProperties = { width: "100%", padding: 11, border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, background: "#fff", color: C.slate };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
