"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { friendlySignInError, friendlyGoogleSignInError } from "@/lib/errors";
import { useIsLocal } from "@/lib/env";
import { Brand } from "./ui";
import { C, FONT_DISPLAY } from "@/lib/theme";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "radial-gradient(1200px 500px at 50% -10%, #e9f7ef 0%, #f4f6f5 55%)" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <Link href="/"><Brand size={52} subtitle="" /></Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CustomerLogin() {
  const { googleLogin } = useStore();
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await googleLogin();
    } catch (e) {
      // Without this the promise rejected silently and the button just did
      // nothing at all when the API was unreachable. The Google chooser adds
      // its own dismissal path, which lands here too.
      setError(friendlyGoogleSignInError(e));
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: "0 20px 50px -24px rgba(2,20,10,.35)", padding: 26 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21, textAlign: "center", margin: "0 0 4px" }}>Welcome back</h1>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13.5, margin: "0 0 22px" }}>Sign in to book courts and track your sessions.</p>
        <button onClick={signIn} disabled={busy} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 13, border: `1px solid ${C.border}`, borderRadius: 13, background: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 14, color: C.slate }}>
          <GoogleIcon /> {busy ? "Signing in…" : "Continue with Google"}
        </button>
        {error && <div style={{ fontSize: 12.5, color: "#e11d48", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>{error}</div>}
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link href="/" style={{ fontSize: 12.5, color: C.faint }}>← Back to home</Link>
      </div>
    </Shell>
  );
}

export function ProfileSetup() {
  const { currentCustomer, completeProfile, logout } = useStore();
  const [name, setName] = React.useState(currentCustomer.name);
  const [phone, setPhone] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const valid = phone.trim().length >= 7;

  return (
    <Shell>
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: "0 20px 50px -24px rgba(2,20,10,.35)", padding: 26 }}>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21, textAlign: "center", margin: "0 0 4px" }}>Complete your profile</h1>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13.5, margin: "0 0 20px" }}>Welcome! We just need a phone number to finish setting up your account.</p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "#f7faf9", border: `1px solid ${C.border2}`, borderRadius: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30 }}><GoogleIcon /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentCustomer.email}</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>Signed in with Google</div>
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inp} />

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 12, display: "block" }}>Email</label>
        <input value={currentCustomer.email} readOnly style={{ ...inp, background: "#f7faf9", color: C.muted }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 12, display: "block" }}>Phone number <span style={{ color: "#f43f5e" }}>*</span></label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setTouched(true)} inputMode="tel" placeholder="0917 000 0000" style={{ ...inp, borderColor: touched && !valid ? C.blockBorder : C.border }} />
        {touched && !valid && <div style={{ fontSize: 12, color: "#e11d48", marginTop: 6 }}>Please enter a valid phone number.</div>}

        <button onClick={() => valid && completeProfile(name, phone)} disabled={!valid} style={{ width: "100%", marginTop: 18, padding: 13, border: "none", borderRadius: 13, background: valid ? C.greenGrad : "#cbd5cf", color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: valid ? "pointer" : "not-allowed", boxShadow: valid ? "0 8px 20px -8px rgba(22,163,74,.8)" : "none" }}>
          Continue
        </button>
        <button onClick={logout} style={{ width: "100%", marginTop: 8, padding: 10, border: "none", background: "none", color: C.faint, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
      </div>
    </Shell>
  );
}

export function AdminLogin() {
  const { adminLogin } = useStore();
  const router = useRouter();
  const isLocal = useIsLocal();
  // Never pre-fill credentials on a deployed console — that would advertise a
  // working admin login to anyone who opens the page.
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!isLocal) return;
    // Matches the seeded admin (db/seeds/001-default-admin.seed.ts).
    setEmail("admin@pickleplay.co");
    setPassword("P@ssw0rd123");
  }, [isLocal]);

  async function submit(em: string, pw: string) {
    setBusy(true);
    setError("");
    try {
      await adminLogin(em, pw);
      router.push("/admin");
    } catch (e) {
      setError(friendlySignInError(e));
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 22, boxShadow: "0 20px 50px -24px rgba(2,20,10,.35)", padding: 26 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, background: "#f1f5f4", padding: "4px 10px", borderRadius: 999 }}>Admin console</span>
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 21, textAlign: "center", margin: "0 0 4px" }}>Staff sign in</h1>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 13.5, margin: "0 0 22px" }}>Manage bookings, approvals, courts and reports.</p>
        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
        <label style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 12, display: "block" }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
        {error && <div style={{ fontSize: 12.5, color: "#e11d48", marginTop: 10 }}>{error}</div>}
        <button disabled={busy} onClick={() => submit(email, password)} style={{ width: "100%", marginTop: 18, padding: 13, border: "none", borderRadius: 13, background: C.dark, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: "#fff" }}>
          {busy ? "Signing in…" : "Sign in to admin"}
        </button>

        {/* Local only: the seeded admin shortcut must not ship to a deployment. */}
        {isLocal && (
        <div style={{ marginTop: 18, borderTop: `1px solid ${C.border2}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: C.faint, marginBottom: 8, textAlign: "center" }}>Sample login</div>
          <button onClick={() => submit("admin@pickleplay.co", "P@ssw0rd123")} style={{ ...sampleBtn, width: "100%" }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13 }}>Admin</span>
            <span style={{ fontSize: 11, color: C.faint }}>Full access · seeded account</span>
          </button>
          <p style={{ fontSize: 11, color: C.faint, textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>Seeded admin, password is P@ssw0rd123. Create staff from User management.</p>
        </div>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: C.muted }}>
        Not staff? <Link href="/login" style={{ fontWeight: 600 }}>Customer login</Link>
      </div>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <Link href="/" style={{ fontSize: 12.5, color: C.faint }}>← Back to home</Link>
      </div>
    </Shell>
  );
}

const inp: React.CSSProperties = { width: "100%", marginTop: 5, padding: "11px 12px", border: `1px solid ${C.border}`, borderRadius: 11, fontFamily: FONT_DISPLAY, fontSize: 14, boxSizing: "border-box", color: C.slate };
const sampleBtn: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "center", padding: "10px 8px", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fff", cursor: "pointer", color: C.slate };

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
