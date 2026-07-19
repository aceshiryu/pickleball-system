"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Brand } from "./ui";
import { C, FONT_DISPLAY } from "@/lib/theme";

export default function Landing() {
  const { branding } = useStore();
  const [isMobile, setIsMobile] = useState(false);
  const [heroSrc, setHeroSrc] = useState("/hero.jpg");
  useEffect(() => {
    const rz = () => setIsMobile(window.innerWidth < 820);
    rz();
    window.addEventListener("resize", rz);
    return () => window.removeEventListener("resize", rz);
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,.85)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "12px 16px" : "14px 22px", display: "flex", alignItems: "center", gap: 16 }}>
          <Brand size={isMobile ? 32 : 38} subtitle={isMobile ? "" : "Court booking"} />
          <nav style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? 12 : 18 }}>
            {!isMobile && <a href="#features" style={link}>Features</a>}
            {!isMobile && <a href="#how" style={link}>How it works</a>}
            <Link href="/login" style={{ ...btnPrimary, padding: "9px 18px", fontSize: 14 }}>Log in</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "radial-gradient(1100px 480px at 75% -10%, #dcfce7 0%, rgba(244,246,245,0) 60%)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "36px 16px 24px" : "64px 22px 48px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.05fr .95fr", gap: isMobile ? 28 : 44, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: C.greenD, background: C.offBg, border: `1px solid ${C.offBorder}`, padding: "6px 12px", borderRadius: 999 }}>
              🏓 Now booking, courts across the metro
            </span>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 34 : 46, lineHeight: 1.05, letterSpacing: "-.03em", margin: 0, color: C.ink }}>
              Book your pickleball court in <span style={{ color: C.green }}>seconds.</span>
            </h1>
            <p style={{ fontSize: isMobile ? 15.5 : 17, lineHeight: 1.6, color: C.muted, margin: 0, maxWidth: 520 }}>
              Pick your slot, pay online, and get instant confirmation. {branding.appName} makes reserving courts effortless for players, and painless to manage for facilities.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
              <Link href="/login" style={{ ...btnPrimary, padding: "14px 26px", fontSize: 15 }}>Book a court →</Link>
              <a href="#how" style={{ padding: "14px 24px", borderRadius: 13, border: `1px solid ${C.border}`, background: "#fff", color: C.slate, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>See how it works</a>
            </div>
          </div>

          {/* Hero photo (drop a real photo at /public/hero.jpg to replace the illustration) */}
          <div style={{ borderRadius: 22, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 30px 60px -30px rgba(2,20,10,.4)", background: "#fff", aspectRatio: isMobile ? "16 / 10" : "4 / 3" }}>
            <img
              src={heroSrc}
              onError={() => { if (heroSrc !== "/hero.svg") setHeroSrc("/hero.svg"); }}
              alt="Players on a pickleball court"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "36px 16px" : "48px 22px" }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 28, textAlign: "center", letterSpacing: "-.02em", margin: "0 0 6px" }}>Everything you need to play more</h2>
        <p style={{ textAlign: "center", color: C.muted, margin: "0 0 28px", fontSize: 15 }}>From the first tap to game point.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: 22, boxShadow: "0 1px 2px rgba(16,24,40,.03)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: C.offBg, color: C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{f.icon}</div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16.5, margin: "14px 0 6px" }}>{f.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ background: "#fff", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "36px 16px" : "48px 22px" }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 24 : 28, textAlign: "center", letterSpacing: "-.02em", margin: "0 0 28px" }}>Three steps to the court</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20 }}>
            {STEPS.map((s, i) => (
              <div key={s.title} style={{ padding: "8px 4px" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, width: 34, height: 34, borderRadius: "50%", background: C.dark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>{i + 1}</div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "40px 16px" : "56px 22px" }}>
        <div style={{ borderRadius: 24, background: "linear-gradient(135deg,#0d1b14,#14532d)", padding: isMobile ? "36px 20px" : "48px 32px", textAlign: "center", color: "#fff" }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: isMobile ? 26 : 30, letterSpacing: "-.02em", margin: "0 0 10px" }}>Ready to play?</h2>
          <p style={{ color: "#bbf7d0", fontSize: 15.5, margin: "0 0 24px" }}>Reserve your first court in under a minute.</p>
          <Link href="/login" style={{ ...btnPrimary, padding: "14px 28px", fontSize: 15 }}>Book a court</Link>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: isMobile ? "20px 16px" : "24px 22px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <Brand size={30} subtitle="" />
          <span style={{ marginLeft: "auto", fontSize: 13, color: C.faint }}>© {new Date().getFullYear()} {branding.appName}</span>
        </div>
      </footer>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: 13, background: C.greenGrad, color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px -8px rgba(22,163,74,.8)" };
const link: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: C.muted };

const FEATURES = [
  { icon: "📅", title: "Real-time availability", desc: "See every open slot across courts, live. No double-bookings, no phone tag." },
  { icon: "💸", title: "Fair peak pricing", desc: "Transparent peak and off-peak rates shown on every slot before you commit." },
  { icon: "⚡", title: "Instant confirmation", desc: "Upload your payment, get verified fast, and receive confirmation by email." },
  { icon: "📱", title: "Book on the go", desc: "A calendar that works beautifully on your phone, drag to grab several hours." },
];

const STEPS = [
  { title: "Pick your slot", desc: "Choose a court, tap the hours you want. Your total is calculated instantly." },
  { title: "Pay & upload proof", desc: "Pay using any method the facility accepts and upload your receipt, your slot is held while you do." },
  { title: "Get confirmed", desc: "An admin verifies your payment and your booking is confirmed. See you on the court!" },
];
