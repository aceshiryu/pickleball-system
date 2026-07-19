"use client";

import React from "react";
import { CheckCircle2, Info, AlertCircle, X } from "lucide-react";
import type { BookingStatus } from "../lib/types";
import { useStore } from "../lib/store";
import { C, FONT_DISPLAY, avatarBg, initials as toInitials } from "../lib/theme";

export function Brand({
  size = 38,
  subtitle = "Court booking",
  light = false,
  // Overrides let the Settings preview show unsaved edits.
  logoUrl,
  name,
}: {
  size?: number;
  subtitle?: string;
  light?: boolean;
  logoUrl?: string | null;
  name?: string;
}) {
  const { branding } = useStore();
  const logo = logoUrl !== undefined ? logoUrl : branding.logoUrl;
  const appName = name !== undefined ? name : branding.appName;

  // An uploaded logo replaces the built-in mark entirely.
  if (logo) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <img
          src={logo}
          alt=""
          style={{ width: size, height: size, borderRadius: size * 0.32, objectFit: "cover", flexShrink: 0, boxShadow: "0 6px 16px -6px rgba(2,20,10,.35)" }}
        />
        <BrandText size={size} subtitle={subtitle} light={light} appName={appName} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: C.greenGrad,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 16px -6px rgba(22,163,74,.7)",
        }}
      >
        <div
          style={{
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "inset -3px -3px 0 rgba(0,0,0,.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: size * 0.16,
            bottom: size * 0.16,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#bbf7d0",
          }}
        />
      </div>
      <BrandText size={size} subtitle={subtitle} light={light} appName={appName} />
    </div>
  );
}

function BrandText({
  subtitle,
  light,
  appName,
}: {
  size: number;
  subtitle?: string;
  light?: boolean;
  appName: string;
}) {
  return (
    <div style={{ lineHeight: 1 }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.02em", color: light ? "#fff" : C.ink }}>
        {appName}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: light ? "#6f8a7c" : C.muted2, fontWeight: 500, marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.29,
        background: avatarBg(toInitials(name)),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: size * 0.34,
        color: "#fff",
      }}
    >
      {toInitials(name)}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 480,
  showClose = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  showClose?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(15,23,42,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="pp-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          background: "#fff",
          borderRadius: 22,
          boxShadow: "0 30px 70px -20px rgba(2,20,10,.5)",
          overflow: "hidden",
          margin: "auto",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border3}`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: C.faint, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {showClose && (
            <button onClick={onClose} style={iconBtn}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
        <div style={{ padding: 20, maxHeight: "70vh", overflowY: "auto" }} className="thin-scroll">
          {children}
        </div>
        {footer && (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.border3}`, display: "flex", gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: "#fff",
  color: C.faint,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const STATUS: Record<BookingStatus, { label: string; ink: string; bg: string; dot: string }> = {
  hold: { label: "Holding", ink: "#0369a1", bg: "#f0f9ff", dot: "#0ea5e9" },
  pending_approval: { label: "Pending approval", ink: C.peakInk, bg: C.peakBg, dot: C.peakDot },
  confirmed: { label: "Confirmed", ink: C.offInkD, bg: C.offBg, dot: C.green },
  checked_in: { label: "Checked in", ink: "#0369a1", bg: "#e0f2fe", dot: "#0ea5e9" },
  completed: { label: "Completed", ink: C.muted, bg: "#eef2f0", dot: "#94a3b8" },
  no_show: { label: "No-show", ink: C.peakInk, bg: C.peakBg, dot: "#f59e0b" },
  rejected: { label: "Rejected", ink: C.blockInk2, bg: C.blockBg, dot: "#f43f5e" },
  cancelled: { label: "Cancelled", ink: C.muted, bg: "#f1f5f4", dot: C.faint },
};

export function StatusPill({ status, seen }: { status: BookingStatus; seen?: boolean }) {
  const m =
    status === "pending_approval" && seen
      ? { label: "Admin is reviewing", ink: C.indigoInk, bg: C.indigoBg, dot: C.indigoDot }
      : STATUS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        flexShrink: 0,
        fontSize: 12,
        fontWeight: 600,
        padding: "5px 11px",
        borderRadius: 999,
        color: m.ink,
        background: m.bg,
        fontFamily: FONT_DISPLAY,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: m.dot,
          animation: status === "pending_approval" && seen ? "pp-pulse 1.4s infinite ease-in-out" : undefined,
        }}
      />
      {m.label}
    </span>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  const Icon = { success: CheckCircle2, info: Info, error: AlertCircle };
  const color = { success: C.green, info: "#0ea5e9", error: "#f43f5e" };
  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 90, display: "flex", flexDirection: "column", gap: 8, width: 320 }}>
      {toasts.map((t) => {
        const I = Icon[t.kind];
        return (
          <div
            key={t.id}
            className="pp-modal"
            style={{ background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 10px 30px -12px rgba(2,20,10,.35)", borderRadius: 14, padding: 12, display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            <I style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, color: color[t.kind] }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.ink2 }}>{t.title}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{t.body}</p>
            </div>
            <button onClick={() => dismissToast(t.id)} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer" }}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
