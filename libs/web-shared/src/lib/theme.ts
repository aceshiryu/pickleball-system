import type { CSSProperties } from "react";

// Design tokens ported from the Claude Design handoff.
export const C = {
  bg: "#f4f6f5",
  ink: "#0f172a",
  ink2: "#1e293b",
  slate: "#334155",
  muted: "#64756c",
  muted2: "#7c8a83",
  faint: "#94a3b8",
  border: "#e6ebe8",
  border2: "#eef2f0",
  border3: "#f1f5f4",
  // Brand tokens are CSS variables so branding changes recolor the whole app live.
  green: "var(--brand-primary)",
  greenD: "var(--brand-primary-d)",
  greenGrad: "var(--brand-grad)",
  dark: "var(--brand-secondary)",
  // semantic
  offBg: "#ecfdf5",
  offBorder: "#bbf7d0",
  offInk: "#047857",
  offInkD: "#065f46",
  peakBg: "#fffbeb",
  peakBorder: "#fde68a",
  peakInk: "#b45309",
  peakInkD: "#92400e",
  peakDot: "#f59e0b",
  blockBg: "#fff1f2",
  blockBorder: "#fecdd3",
  blockInk: "#e11d48",
  blockInk2: "#be123c",
  takenBg: "#f1f5f9",
  indigoBg: "#eef2ff",
  indigoInk: "#4338ca",
  indigoDot: "#6366f1",
};

// Resolve through CSS variables so the admin's font choice applies
// system-wide without every call site needing to know about it.
export const FONT_DISPLAY = "var(--font-display)";
export const FONT_BODY = "var(--font-body)";

export const card: CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  boxShadow: "0 1px 2px rgba(16,24,40,.03)",
};

export const primaryBtn: CSSProperties = {
  border: "none",
  borderRadius: 13,
  background: C.greenGrad,
  color: "#fff",
  fontFamily: FONT_DISPLAY,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px -8px rgba(22,163,74,.8)",
};

// deterministic avatar gradient
const AV = [
  "linear-gradient(135deg,#34d399,#059669)",
  "linear-gradient(135deg,#60a5fa,#2563eb)",
  "linear-gradient(135deg,#f472b6,#db2777)",
  "linear-gradient(135deg,#fbbf24,#d97706)",
  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  "linear-gradient(135deg,#2dd4bf,#0d9488)",
  "linear-gradient(135deg,#fb7185,#e11d48)",
  "linear-gradient(135deg,#818cf8,#4f46e5)",
];
export function avatarBg(seed: string): string {
  return AV[(seed.charCodeAt(0) || 0) % AV.length];
}
export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
