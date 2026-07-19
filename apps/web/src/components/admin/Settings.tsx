"use client";

import React, { useEffect, useRef, useState } from "react";
import { Banknote } from "lucide-react";
import { HOLD_MINUTES, useStore, DEFAULT_BRANDING } from "@/lib/store";
import { FONTS } from "@/lib/fonts";
import { deriveSecondary, tint } from "@/lib/color";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";
import { useConfirm } from "../Confirm";
import { Brand } from "../ui";
import Blackouts from "./Blackouts";

type Tab = "branding" | "payments" | "blackouts" | "policies";

const POLICIES: { icon: string; title: string; value: string; desc: string }[] = [
  { icon: "⏱", title: "Payment hold window", value: `${HOLD_MINUTES} minutes`, desc: "Slots are reserved while a customer pays. Unpaid holds release automatically." },
  { icon: "₱", title: "Peak pricing rule", value: "Weekends + weekdays 5 PM", desc: "Peak rates apply all day on weekends and from 5 PM on weekdays." },
  { icon: "✓", title: "Payment verification", value: "Manual, admin-reviewed", desc: "Every booking stays pending until an admin verifies the uploaded receipt." },
  { icon: "⟲", title: "Cancellation", value: "Admin-initiated reopens hours", desc: "When an admin cancels a confirmed booking, the hours reopen for others to book." },
];

export default function Settings({ isMobile }: { isMobile: boolean }) {
  const { paymentMethods, addPaymentMethod, removePaymentMethod, branding, updateBranding, courts, access } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("branding");
  const [newMethod, setNewMethod] = useState("");
  // Edit a local draft and save explicitly. Writing on every keystroke fired a
  // PATCH per character and let the refetched server value clobber what was
  // being typed.
  const [draft, setDraft] = useState(branding);
  const [logoErr, setLogoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(branding);

  // Adopt server state whenever it changes and we have nothing in flight.
  useEffect(() => {
    setDraft((d) => (JSON.stringify(d) === JSON.stringify(branding) ? d : branding));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branding.appName, branding.primary, branding.secondary, branding.logoUrl, branding.fontFamily]);

  function save() {
    updateBranding({
      appName: draft.appName.trim() || DEFAULT_BRANDING.appName,
      primary: draft.primary,
      secondary: deriveSecondary(draft.primary),
      logoUrl: draft.logoUrl,
      fontFamily: draft.fontFamily,
    });
  }

  // Enforce square, then re-encode to 256x256 PNG so the inline data URL stays
  // small (it rides in the public /settings payload on every page load).
  async function pickLogo(file: File) {
    setLogoErr("");
    try {
      const dataUrl = await readAsDataUrl(file);
      const img = await loadImage(dataUrl);
      if (img.naturalWidth !== img.naturalHeight) {
        setLogoErr(`Logo must be square — that one is ${img.naturalWidth}×${img.naturalHeight}. Crop it to 1:1 and try again.`);
        return;
      }
      const size = Math.min(256, img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return setLogoErr("Could not read that image.");
      ctx.drawImage(img, 0, 0, size, size);
      setDraft((d) => ({ ...d, logoUrl: canvas.toDataURL("image/png") }));
    } catch {
      setLogoErr("Could not read that image. Try a PNG, JPEG or WEBP.");
    }
  }
  const tabs: [Tab, string][] = [["branding", "Brand & general"], ["payments", "Payment methods"], ["blackouts", "Blackouts & holidays"], ["policies", "Booking policies"]];
  const canBrand = access === "admin";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, background: "#eef2f0", padding: 4, borderRadius: 12, marginBottom: 20, width: "fit-content", maxWidth: "100%", overflowX: "auto" }} className="thin-scroll">
        {tabs.map(([id, label]) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, padding: "8px 16px", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 13.5, fontFamily: FONT_DISPLAY, background: on ? "#fff" : "transparent", color: on ? C.greenD : C.muted, boxShadow: on ? "0 1px 3px rgba(16,24,40,.1)" : "none" }}>{label}</button>
          );
        })}
      </div>

      {tab === "branding" && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Brand &amp; identity</div>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px" }}>Changes apply across the whole system instantly, the landing page, customer app and admin console.</p>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Project / app name</label>
            <input
              value={draft.appName}
              disabled={!canBrand}
              onChange={(e) => setDraft({ ...draft, appName: e.target.value })}
              placeholder="e.g. CourtHub"
              style={txt}
            />

            {/* Square logo */}
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 14, display: "block" }}>Logo</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
              <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 18, border: `1px solid ${C.border}`, background: draft.logoUrl ? "#fff" : C.greenGrad, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {draft.logoUrl
                  ? <img src={draft.logoUrl} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickLogo(f); e.target.value = ""; }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => fileRef.current?.click()} disabled={!canBrand} style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, cursor: canBrand ? "pointer" : "not-allowed" }}>
                    {draft.logoUrl ? "Change logo" : "Upload logo"}
                  </button>
                  {draft.logoUrl && canBrand && (
                    <button onClick={() => setDraft({ ...draft, logoUrl: null })} style={{ padding: "9px 14px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: C.blockInk2, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Remove</button>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6, lineHeight: 1.5 }}>
                  Must be square (1:1) — PNG, JPEG or WEBP. Resized to 256×256.
                </div>
                {logoErr && <div style={{ fontSize: 12, color: "#e11d48", fontWeight: 500, marginTop: 6 }}>{logoErr}</div>}
              </div>
            </div>

            {/* Font — applies to headings and body across the whole system. */}
            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 14, display: "block" }}>Font</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8, marginTop: 6 }}>
              {FONTS.map((f) => {
                const on = draft.fontFamily === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => canBrand && setDraft({ ...draft, fontFamily: f.key })}
                    disabled={!canBrand}
                    style={{ textAlign: "left", padding: "10px 12px", borderRadius: 12, cursor: canBrand ? "pointer" : "default", border: `1px solid ${on ? C.green : C.border}`, background: on ? C.offBg : "#fff" }}
                  >
                    <span style={{ display: "block", fontFamily: f.display, fontWeight: 700, fontSize: 15, color: on ? C.greenD : C.ink2 }}>{f.label}</span>
                    <span style={{ display: "block", fontSize: 11, color: C.faint, marginTop: 2 }}>{f.note}</span>
                  </button>
                );
              })}
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 14, display: "block" }}>Brand color</label>
            <ColorField value={draft.primary} disabled={!canBrand} onChange={(v) => setDraft({ ...draft, primary: v })} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "10px 12px", background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>Derived</span>
              <Sw c={draft.primary} t="Primary" />
              <Sw c={deriveSecondary(draft.primary)} t="Secondary (dark chrome)" />
              <Sw c={tint(draft.primary)} t="Tint" />
              <span style={{ fontSize: 11.5, color: C.faint, marginLeft: "auto", textAlign: "right", lineHeight: 1.4 }}>
                Generated from your brand color
              </span>
            </div>

            {canBrand && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button onClick={save} disabled={!dirty} style={{ ...primaryBtn, padding: "10px 18px", fontSize: 13.5, boxShadow: "none", background: dirty ? primaryBtn.background : "#cbd5cf", cursor: dirty ? "pointer" : "not-allowed" }}>
                  {dirty ? "Save changes" : "Saved"}
                </button>
                {dirty && (
                  <button onClick={() => { setDraft(branding); setLogoErr(""); }} style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Discard</button>
                )}
                <button onClick={() => setDraft({ ...draft, ...DEFAULT_BRANDING })} style={{ padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 11, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reset to defaults</button>
              </div>
            )}
            {!canBrand && <p style={{ fontSize: 12.5, color: C.faint, marginTop: 12 }}>Only admins can change branding.</p>}

            <div style={{ marginTop: 20, borderTop: `1px solid ${C.border2}`, paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 6 }}>Facility setup</div>
              <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>Number of courts and rates per booking (peak &amp; off-peak) are managed in <b>Court Management</b> — add or remove courts and set each court&apos;s hourly rates there. You currently have <b>{courts.length}</b> court{courts.length === 1 ? "" : "s"}.</p>
            </div>
          </div>

          {/* Live preview */}
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 12 }}>Live preview</div>
            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0" }}><Brand size={44} logoUrl={draft.logoUrl} name={draft.appName} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              <button style={{ ...primaryBtn, padding: 12, fontSize: 14 }}>Primary button</button>
              <button style={{ padding: 12, borderRadius: 12, border: "none", background: C.dark, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "default" }}>Secondary button</button>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: "#fff", border: `1px solid ${C.green}`, padding: "6px 12px", borderRadius: 999 }}>Accent chip</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.greenGrad, padding: "6px 12px", borderRadius: 999 }}>Gradient</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "payments" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 13.5, color: C.muted, margin: 0, maxWidth: 520 }}>The payment methods customers can choose at checkout, and that staff record when approving a booking.</p>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { addPaymentMethod(newMethod); setNewMethod(""); } }}
                placeholder="e.g. GCash, Maya, BPI transfer"
                maxLength={40}
                style={{ flex: 1, padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, color: C.slate }}
              />
              <button
                onClick={() => { addPaymentMethod(newMethod); setNewMethod(""); }}
                disabled={!newMethod.trim()}
                style={{ ...primaryBtn, padding: "10px 16px", fontSize: 14, boxShadow: "none", opacity: newMethod.trim() ? 1 : 0.5, cursor: newMethod.trim() ? "pointer" : "not-allowed" }}
              >
                Add
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 20px", border: `1.5px dashed ${C.border}`, borderRadius: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: C.offBg, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}><Banknote style={{ width: 24, height: 24 }} /></div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>No payment methods yet</div>
                <div style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>Add at least one so customers know how to pay.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {paymentMethods.map((m) => (
                  <div key={m} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", border: `1px solid ${C.border2}`, borderRadius: 12, background: "#f7faf9" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.slate }}>
                      <Banknote style={{ width: 17, height: 17, color: C.muted }} />
                      {m}
                    </span>
                    <button
                      onClick={async () => { if (await confirm({ title: "Remove payment method?", message: `Customers will no longer see ${m} at checkout.`, confirmLabel: "Remove", danger: true })) removePaymentMethod(m); }}
                      style={{ fontSize: 12.5, color: C.blockInk2, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "blackouts" && <Blackouts isMobile={isMobile} />}

      {tab === "policies" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {POLICIES.map((p) => (
            <div key={p.title} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 20, display: "flex", gap: 14 }}>
              <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 12, background: C.offBg, color: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{p.icon}</div>
              <div>
                <div style={{ fontSize: 12.5, color: C.faint, fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, margin: "3px 0 6px" }}>{p.value}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Sw({ c, t }: { c: string; t: string }) {
  return <span title={`${t} · ${c}`} style={{ width: 26, height: 26, borderRadius: 8, background: c, border: `1px solid ${C.border}`, flexShrink: 0 }} />;
}

const txt: React.CSSProperties = { width: "100%", marginTop: 5, padding: "11px 12px", border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, boxSizing: "border-box", color: C.slate, background: "#fff" };

function ColorField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, border: `1px solid ${C.border}`, borderRadius: 11, padding: "6px 8px 6px 6px", background: "#fff" }}>
      <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ width: 34, height: 34, border: "none", borderRadius: 8, background: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer" }} />
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontFamily: "monospace", fontSize: 13, color: C.slate, background: "transparent" }} />
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("bad image"));
    img.src = src;
  });
}
