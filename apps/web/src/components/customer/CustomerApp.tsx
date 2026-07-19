"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Brand } from "../ui";
import { C, FONT_DISPLAY, avatarBg, initials } from "@/lib/theme";
import BookingCalendar from "./BookingCalendar";
import MyBookings from "./MyBookings";

export default function CustomerApp() {
  const { currentCustomer, logout } = useStore();
  const [screen, setScreen] = useState<"book" | "mine">("book");
  const [menu, setMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const rz = () => setIsMobile(window.innerWidth < 768);
    rz();
    window.addEventListener("resize", rz);
    return () => window.removeEventListener("resize", rz);
  }, []);

  const navBtn = (on: boolean): React.CSSProperties => ({
    padding: "8px 15px",
    border: "none",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13.5,
    fontFamily: FONT_DISPLAY,
    flex: isMobile ? 1 : undefined,
    background: on ? "#fff" : "transparent",
    color: on ? C.greenD : C.muted,
    boxShadow: on ? "0 1px 3px rgba(16,24,40,.1)" : "none",
  });

  const avatarMenu = (
    <div style={{ position: "relative" }}>
      <button onClick={() => setMenu((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 12px 5px 5px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 999, cursor: "pointer" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg(initials(currentCustomer.name)), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: "#fff" }}>{initials(currentCustomer.name)}</div>
        {!isMobile && <span style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>{currentCustomer.name.split(" ")[0]}</span>}
      </button>
      {menu && (
        <div onMouseLeave={() => setMenu(false)} style={{ position: "absolute", right: 0, marginTop: 8, width: 210, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: "0 12px 30px -12px rgba(2,20,10,.3)", padding: 8, zIndex: 50 }}>
          <div style={{ padding: "6px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink2 }}>{currentCustomer.name}</div>
            <div style={{ fontSize: 12, color: C.faint }}>{currentCustomer.email}</div>
          </div>
          <div style={{ height: 1, background: C.border2, margin: "6px 0" }} />
          <button onClick={logout} style={{ width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, color: C.blockInk2, background: "none", border: "none", borderRadius: 8, cursor: "pointer" }}>Sign out</button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        {isMobile ? (
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Brand size={32} subtitle="" />
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                {avatarMenu}
              </div>
            </div>
            <nav style={{ display: "flex", gap: 4, background: "#eef2f0", padding: 4, borderRadius: 12 }}>
              <button onClick={() => setScreen("book")} style={navBtn(screen === "book")}>Book a court</button>
              <button onClick={() => setScreen("mine")} style={navBtn(screen === "mine")}>My bookings</button>
            </nav>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 22px", display: "flex", alignItems: "center", gap: 14 }}>
            <Brand />
            <nav style={{ marginLeft: 24, display: "flex", gap: 4, background: "#eef2f0", padding: 4, borderRadius: 12 }}>
              <button onClick={() => setScreen("book")} style={navBtn(screen === "book")}>Book a court</button>
              <button onClick={() => setScreen("mine")} style={navBtn(screen === "mine")}>My bookings</button>
            </nav>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              {avatarMenu}
            </div>
          </div>
        )}
      </header>

      {screen === "book" ? (
        <main style={{ flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: isMobile ? "18px 16px 120px" : "22px 22px 120px" }}>
          <BookingCalendar />
        </main>
      ) : (
        <MyBookings onBook={() => setScreen("book")} />
      )}
    </div>
  );
}
