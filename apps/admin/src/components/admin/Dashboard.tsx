"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, Banknote, UserPlus, LayoutGrid, ClipboardCheck, LogIn, Flag, type LucideIcon } from "lucide-react";
import { useStore } from "@shared/lib/store";
import { peso } from "@shared/lib/pricing";
import { hourLabel, prettyDate, todayISO } from "@shared/lib/dates";
import { isToday } from "@shared/lib/analytics";
import { C, FONT_DISPLAY } from "@shared/lib/theme";
import { Avatar, Modal, StatusPill } from "@shared/components/ui";
import { useConfirm } from "@shared/components/Confirm";
import type { Booking, Court } from "@shared/lib/types";
import type { Page } from "./AdminApp";

export default function Dashboard({ onGoto, isMobile }: { onGoto: (p: Page) => void; isMobile: boolean }) {
  const { bookings, courts, paymentMethods, staff, onboardingComplete, access, checkInBooking, completeBooking, markNoShow } = useStore();
  const confirm = useConfirm();
  async function doCheckIn(b: Booking) {
    if (await confirm({ title: "Check in player?", message: `Mark ${b.customerName} as checked in on ${b.courtName}. Anyone currently checked in there will be completed.`, confirmLabel: "Check in" })) checkInBooking(b.id);
  }
  async function doComplete(b: Booking) {
    if (await confirm({ title: "Complete session?", message: `End ${b.customerName}'s session on ${b.courtName} and free the court.`, confirmLabel: "Complete" })) completeBooking(b.id);
  }
  async function doNoShow(b: Booking) {
    if (await confirm({ title: "Mark as no-show?", message: `${b.customerName} did not arrive for their booking on ${b.courtName}. Their court time will be released.`, confirmLabel: "Mark no-show", danger: true })) markNoShow(b.id);
  }
  const [queueCourt, setQueueCourt] = useState<Court | null>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const pending = bookings.filter((b) => b.status === "pending_approval");
  const nowDec = now.getHours() + now.getMinutes() / 60;

  // Overtime = a checked-in booking that should already have ended
  const endHourOf = (b: Booking) => b.slots[b.slots.length - 1].hour + 1;
  const overtimeMins = (b: Booking) => Math.max(0, Math.round((nowDec - endHourOf(b)) * 60));
  const isOvertime = (b: Booking) => b.status === "checked_in" && nowDec > endHourOf(b);

  // Per-court today queue (confirmed + checked in), sorted by hour
  const courtStatus = courts.map((c) => ({
    court: c,
    queue: bookings
      .filter((b) => b.courtId === c.id && (b.status === "confirmed" || b.status === "checked_in") && isToday(b))
      .sort((a, b) => a.slots[0].hour - b.slots[0].hour),
  }));

  // Full day's list for the queue modal (per court)
  const dayList = (courtId: string) =>
    bookings
      .filter((b) => b.courtId === courtId && isToday(b) && (b.status === "confirmed" || b.status === "checked_in" || b.status === "completed"))
      .sort((a, b) => a.slots[0].hour - b.slots[0].hour);

  // Onboarding + milestone checklist
  const hasConfirmed = bookings.some((b) => b.status === "confirmed" || b.status === "checked_in" || b.status === "completed");
  const hasCheckedIn = bookings.some((b) => b.status === "checked_in" || b.status === "completed");
  const hasCompleted = bookings.some((b) => b.status === "completed");

  type Item = { done: boolean; label: string; hint: string; icon: LucideIcon; optional?: boolean; action?: () => void; actionLabel?: string };
  const setupItems: Item[] = [
    { done: paymentMethods.length > 0, label: "Add a payment method", hint: "Tell customers how they can pay.", icon: Banknote, action: () => onGoto("settings"), actionLabel: "Add method" },
    { done: courts.length > 0, label: "Add your courts", hint: "Set names, surfaces and rates.", icon: LayoutGrid, action: () => onGoto("courts"), actionLabel: "Courts" },
    { done: staff.length > 1, label: "Invite a staff member", hint: "Optional. Give your team access.", icon: UserPlus, optional: true, action: () => onGoto("users"), actionLabel: "Staff" },
  ];
  const milestoneItems: Item[] = [
    { done: hasConfirmed, label: "Confirm a booking", hint: "Approve a paid booking in Approvals.", icon: ClipboardCheck, action: () => onGoto("approvals"), actionLabel: "Approvals" },
    { done: hasCheckedIn, label: "Check in a booking", hint: "Mark a player as arrived from Bookings.", icon: LogIn, action: () => onGoto("bookings"), actionLabel: "Bookings" },
    { done: hasCompleted, label: "Complete a booking", hint: "Marked automatically when the next player checks in.", icon: Flag },
  ];
  // Setup card while onboarding incomplete; then milestones until all done; then hidden.
  const showSetup = access === "admin" && !onboardingComplete;
  const milestonesDone = hasConfirmed && hasCheckedIn && hasCompleted;
  const showMilestones = access === "admin" && onboardingComplete && !milestonesDone;
  const showChecklist = showSetup || showMilestones;
  const activeList = showSetup ? setupItems : milestoneItems;
  const listTitle = showSetup ? "Finish setting up your facility" : "Getting started";
  const doneCount = activeList.filter((i) => i.done || i.optional).length;

  return (
    <div>
      {/* Live date + moving time board */}
      <div style={{ background: "linear-gradient(135deg,#0d1b14,#14532d)", borderRadius: 20, padding: isMobile ? "18px 20px" : "20px 24px", marginBottom: 18, color: "#fff", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#bbf7d0", textTransform: "uppercase", letterSpacing: ".05em" }}>Today</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 18 : 22, letterSpacing: "-.01em" }}>{dateStr}</div>
        </div>
        <div style={{ marginLeft: isMobile ? 0 : "auto", textAlign: isMobile ? "left" : "right" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 30 : 36, letterSpacing: ".04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
          <div style={{ fontSize: 12, color: "#bbf7d0", marginTop: 4 }}>Local facility time</div>
        </div>
      </div>

      {/* Onboarding / milestones checklist (hidden once complete) */}
      {showChecklist && (
        <div style={{ background: "#fff", border: `1px solid ${showSetup ? C.peakBorder : C.border}`, borderRadius: 20, padding: 20, marginBottom: 18, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{listTitle}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, background: "#f1f5f4", padding: "3px 9px", borderRadius: 999 }}>{doneCount}/{activeList.length}</span>
            {showSetup && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.peakInk, background: C.peakBg, padding: "3px 9px", borderRadius: 999 }}>Setup required</span>}
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: "0 0 14px" }}>{showSetup ? "Add a payment method to start accepting bookings. Staff is optional." : "Run a booking through the full flow to get familiar with the console."}</p>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {activeList.map((it) => {
              const Icon = it.icon;
              const done = it.done;
              return (
                <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: `1px solid ${done ? C.offBorder : C.border2}`, background: done ? C.offBg : "#fff", borderRadius: 14 }}>
                  {done ? <CheckCircle2 style={{ width: 22, height: 22, color: C.green, flexShrink: 0 }} /> : <Circle style={{ width: 22, height: 22, color: "#cbd5cf", flexShrink: 0 }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink2, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon style={{ width: 14, height: 14, color: C.muted }} />{it.label}{it.optional && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.faint }}>OPTIONAL</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{it.hint}</div>
                  </div>
                  {!done && it.action && (
                    <button onClick={it.action} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 10, border: "none", background: showSetup && it.actionLabel === "Add method" ? C.green : C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{it.actionLabel}</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live court status — 3-column cards showing the current player, queue behind a modal */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Court status</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {courtStatus.map(({ court, queue }) => {
            const maint = court.status === "maintenance";
            const current = queue.find((b) => b.status === "checked_in");
            const upcoming = queue.filter((b) => b.status === "confirmed");
            const next = upcoming[0];
            const over = current ? isOvertime(current) : false;
            const restCount = queue.length - (current ? 1 : 0);
            const state = maint ? "maint" : current ? (over ? "over" : "busy") : "open";
            const chip = state === "over" ? { t: "Overtime", c: C.blockInk2, bg: C.blockBg } : state === "busy" ? { t: "In use", c: "#0369a1", bg: "#e0f2fe" } : state === "maint" ? { t: "Maintenance", c: C.peakInk, bg: C.peakBg } : { t: "Available", c: C.green, bg: C.offBg };
            const border = over ? C.blockBorder : current ? "#bae6fd" : C.border;
            return (
              <div key={court.id} style={{ background: "#fff", border: `1px solid ${border}`, borderRadius: 18, padding: 16, boxShadow: "0 1px 2px rgba(16,24,40,.03)", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{court.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: chip.c, background: chip.bg }}>{chip.t}</span>
                </div>

                <div style={{ flex: 1 }}>
                  {maint ? (
                    <div style={{ fontSize: 13, color: C.faint, padding: "22px 0", textAlign: "center" }}>Court under maintenance</div>
                  ) : current ? (
                    <div style={{ borderRadius: 12, border: `1px solid ${over ? C.blockBorder : "#7dd3fc"}`, background: over ? C.blockBg : "#e0f2fe", padding: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={current.customerName} size={40} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14.5, color: C.ink2 }}>{current.customerName}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{hourLabel(current.slots[0].hour)} to {hourLabel(endHourOf(current))}</div>
                        </div>
                      </div>
                      {over ? (
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.blockInk2, marginTop: 8 }}>⚠ Overtime by {overtimeMins(current) >= 60 ? `${Math.floor(overtimeMins(current) / 60)}h ${overtimeMins(current) % 60}m` : `${overtimeMins(current)}m`}</div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#0369a1", marginTop: 8, fontWeight: 600 }}>Currently on the court</div>
                      )}
                      <button onClick={() => doComplete(current)} style={{ width: "100%", marginTop: 10, padding: 10, border: "none", borderRadius: 10, background: over ? "#e11d48" : C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Complete session</button>
                    </div>
                  ) : next ? (
                    <div style={{ borderRadius: 12, border: `1px solid ${C.border2}`, padding: 12 }}>
                      <div style={{ fontSize: 11.5, color: C.faint, marginBottom: 8, fontWeight: 600 }}>Next up today</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={next.customerName} size={36} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: C.ink2 }}>{next.customerName}</div>
                          <div style={{ fontSize: 12, color: C.faint }}>{hourLabel(next.slots[0].hour)}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={() => doCheckIn(next)} style={{ flex: 1, padding: 10, border: `1px solid ${C.green}`, borderRadius: 10, background: C.offBg, color: C.offInkD, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Check in</button>
                        <button onClick={() => doNoShow(next)} style={{ padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, background: "#fff", color: C.peakInk, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>No-show</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: C.faint, padding: "22px 0", textAlign: "center" }}>No bookings today</div>
                  )}
                </div>

                {!maint && restCount > 0 && (
                  <button onClick={() => setQueueCourt(court)} style={{ marginTop: 12, width: "100%", padding: 9, borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
                    See next queues ({restCount}) →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Full-day queue modal for a court */}
      <Modal open={!!queueCourt} onClose={() => setQueueCourt(null)} maxWidth={480} title={queueCourt ? `${queueCourt.name} queue` : ""} subtitle={prettyDate(todayISO())}>
        {queueCourt && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dayList(queueCourt.id).length === 0 ? (
              <div style={{ fontSize: 13, color: C.faint, padding: "24px 0", textAlign: "center" }}>No bookings today.</div>
            ) : (
              dayList(queueCourt.id).map((b) => {
                const over = isOvertime(b);
                return (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, border: `1px solid ${b.status === "checked_in" ? (over ? C.blockBorder : "#7dd3fc") : C.border2}`, background: b.status === "checked_in" ? (over ? C.blockBg : "#e0f2fe") : "#fff" }}>
                    <Avatar name={b.customerName} size={34} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: C.ink2 }}>{b.customerName}</div>
                      <div style={{ fontSize: 12, color: C.faint }}>{hourLabel(b.slots[0].hour)} to {hourLabel(endHourOf(b))}{over ? ` · overtime ${overtimeMins(b)}m` : ""}</div>
                    </div>
                    {b.status === "confirmed" ? (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => doCheckIn(b)} style={{ padding: "7px 11px", borderRadius: 9, border: `1px solid ${C.green}`, background: C.offBg, color: C.offInkD, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Check in</button>
                        <button onClick={() => doNoShow(b)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", color: C.peakInk, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>No-show</button>
                      </div>
                    ) : b.status === "checked_in" ? (
                      <button onClick={() => doComplete(b)} style={{ flexShrink: 0, padding: "7px 11px", borderRadius: 9, border: "none", background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>Complete</button>
                    ) : (
                      <StatusPill status={b.status} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </Modal>

      {/* Approval queue */}
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>Needs your approval</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.peakInk, background: C.peakBg, padding: "3px 9px", borderRadius: 999 }}>{pending.length}</span>
          <button onClick={() => onGoto("approvals")} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: C.green, background: "none", border: "none", cursor: "pointer" }}>View all →</button>
        </div>
        {pending.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
            {pending.slice(0, 6).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, border: `1px solid ${C.border2}`, borderRadius: 14 }}>
                <Avatar name={p.customerName} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink2 }}>{p.customerName}</div>
                  <div style={{ fontSize: 12.5, color: C.muted2 }}>{p.courtName} · {p.hours} hr{p.hours > 1 ? "s" : ""}</div>
                </div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>{peso(p.total)}</div>
                <button onClick={() => onGoto("approvals")} style={{ flexShrink: 0, padding: "9px 14px", border: "none", borderRadius: 11, background: C.green, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Review</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "36px 16px" }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: C.offBg, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><CheckCircle2 style={{ width: 24, height: 24 }} /></div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#475569" }}>All caught up</div>
            <div style={{ fontSize: 12.5, color: C.faint, marginTop: 3 }}>No payments waiting for review.</div>
          </div>
        )}
      </div>

    </div>
  );
}
