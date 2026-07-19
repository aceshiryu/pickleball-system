"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import type { CreatedStaff } from "@/lib/store";
import type { AccessLevel } from "@/lib/types";
import { Avatar, Modal } from "../ui";
import { useConfirm } from "../Confirm";
import { C, FONT_DISPLAY, primaryBtn } from "@/lib/theme";

const ALLOWED = ["Dashboard", "Approvals", "Bookings", "Booking calendar", "Customers", "Court management", "Settings"];

export default function Users({ isMobile }: { isMobile: boolean }) {
  const { staff, addStaff, resetStaffPassword, removeStaff, setStaffAccess, signInAs, adminName } = useStore();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<AccessLevel>("staff");
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [mode, setMode] = useState<"created" | "reset">("created");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function copyPassword(pw: string) {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions) — the password
      // stays visible so it can be copied by hand.
      setCopied(false);
    }
  }

  async function submit() {
    if (!name.trim() || !email.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const c = await addStaff({ name: name.trim(), email: email.trim(), access });
      setMode("created");
      setCreated(c);
      // Copy straight away — this is the only time the password is available.
      await copyPassword(c.tempPassword);
      setName(""); setEmail(""); setAccess("staff");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, staffName: string) {
    const ok = await confirm({
      title: "Regenerate password?",
      message: `${staffName}'s current password will stop working immediately. You'll get a new one to share with them.`,
      confirmLabel: "Regenerate",
    });
    if (!ok) return;
    const updated = await resetStaffPassword(id);
    setMode("reset");
    setCreated(updated);
    await copyPassword(updated.tempPassword);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Staff list */}
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Staff accounts</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>You are signed in as <b>{adminName}</b>. Set each account as Admin (full access) or Staff (limited).</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {staff.map((s) => (
            <div key={s.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 10 : 12, padding: 12, border: `1px solid ${C.border2}`, borderRadius: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                <Avatar name={s.name} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink2 }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.email}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, color: s.access === "admin" ? C.offInkD : C.indigoInk, background: s.access === "admin" ? C.offBg : C.indigoBg }}>
                  {s.access === "admin" ? "Admin" : "Staff"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <select value={s.access} onChange={(e) => setStaffAccess(s.id, e.target.value as AccessLevel)} style={{ ...sel, flex: isMobile ? 1 : undefined }}>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
                <button onClick={() => signInAs(s.id)} style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", color: C.slate, fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>View as</button>
                <button onClick={() => resetPassword(s.id, s.name)} title="Generate a new password for this account" style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", color: C.slate, fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>Reset password</button>
                <button onClick={async () => { if (await confirm({ title: "Remove staff account?", message: `Revoke ${s.name}'s access. This cannot be undone.`, confirmLabel: "Remove", danger: true })) removeStaff(s.id); }} style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, border: `1px solid ${C.border}`, background: "#fff", color: C.faint, cursor: "pointer" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create form */}
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: 20 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Create staff</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Rivera" style={txt} /></Field>
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@pickleplay.co" style={txt} /></Field>
          <Field label="Access level">
            <select value={access} onChange={(e) => setAccess(e.target.value as AccessLevel)} style={txt}>
              <option value="staff">Staff (limited)</option>
              <option value="admin">Admin (full access)</option>
            </select>
          </Field>
          <button onClick={submit} disabled={!name.trim() || !email.trim() || busy} style={{ ...primaryBtn, width: "100%", padding: 13, fontSize: 14, boxShadow: "none", opacity: name.trim() && email.trim() && !busy ? 1 : 0.5, cursor: name.trim() && email.trim() && !busy ? "pointer" : "not-allowed" }}>{busy ? "Creating…" : "Add staff"}</button>
          {error && <div style={{ fontSize: 12.5, color: "#e11d48", fontWeight: 500 }}>{error}</div>}
          <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.5 }}>A temporary password is generated automatically and shown once, so you can share it with them.</div>
        </div>

        <div style={{ marginTop: 18, borderTop: `1px solid ${C.border2}`, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint, marginBottom: 8 }}>Staff access</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ALLOWED.map((a) => (
              <span key={a} style={{ fontSize: 11.5, fontWeight: 600, color: C.offInkD, background: C.offBg, border: `1px solid ${C.offBorder}`, padding: "3px 9px", borderRadius: 999 }}>{a}</span>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Staff cannot access <b>Sales</b>, <b>Reports</b>, or <b>User management</b>. Admins have full access.</div>
        </div>
      </div>

      {/* One-time credentials for the account just created */}
      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        maxWidth={440}
        title={mode === "created" ? "Account created" : "New password generated"}
        subtitle={created ? `${created.name} · ${created.access === "admin" ? "Admin" : "Staff"}` : ""}
        footer={
          <button onClick={() => setCreated(null)} style={{ ...primaryBtn, flex: 1, padding: 13, fontSize: 14 }}>Done</button>
        }
      >
        {created && (
          <div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.55, marginBottom: 14 }}>
              {mode === "reset" && (
                <>Their previous password no longer works. </>
              )}
              Share these sign-in details with <b style={{ color: C.ink2 }}>{created.name}</b>. The password is shown <b style={{ color: C.ink2 }}>only now</b> — it is stored encrypted and cannot be retrieved later.
            </div>

            <div style={{ background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Email</div>
              <div style={{ fontFamily: "monospace", fontSize: 13.5, color: C.ink2, wordBreak: "break-all", marginBottom: 12 }}>{created.email}</div>

              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Temporary password</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <code style={{ flex: 1, fontFamily: "monospace", fontSize: 17, fontWeight: 700, letterSpacing: ".04em", color: C.ink2, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", wordBreak: "break-all" }}>{created.tempPassword}</code>
                <button
                  onClick={() => copyPassword(created.tempPassword)}
                  style={{ flexShrink: 0, padding: "11px 14px", borderRadius: 10, border: `1px solid ${copied ? C.green : C.border}`, background: copied ? C.offBg : "#fff", color: copied ? C.greenD : C.slate, fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
              They can sign in at the staff login with this password right away.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const txt: React.CSSProperties = { width: "100%", padding: 11, border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, boxSizing: "border-box", color: C.slate, background: "#fff" };
const sel: React.CSSProperties = { padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 9, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 12.5, background: "#fff", color: C.slate, cursor: "pointer" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
