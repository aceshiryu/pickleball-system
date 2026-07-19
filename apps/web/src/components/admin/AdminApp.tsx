"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ClipboardCheck, ClipboardList, CalendarDays, Banknote, BarChart3, Users as UsersIcon, LayoutGrid, Settings as SettingsIcon, UserCog, LogOut, type LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { useIsLocal } from "@/lib/env";
import { C, FONT_DISPLAY, avatarBg, initials } from "@/lib/theme";
import BrandMark from "../BrandMark";
import Dashboard from "./Dashboard";
import Approvals from "./Approvals";
import Bookings from "./Bookings";
import AdminCalendar from "./AdminCalendar";
import Users from "./Users";
import Sales from "./Sales";
import Reports from "./Reports";
import Customers from "./Customers";
import Courts from "./Courts";
import Settings from "./Settings";
import Onboarding from "./Onboarding";

export type Page = "dashboard" | "approvals" | "bookings" | "calendar" | "sales" | "reports" | "customers" | "courts" | "settings" | "users";

// Content column width. The header and <main> share it so they stay aligned.
const CONTENT_MAX = 1200;

const NAV: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "bookings", label: "Bookings", icon: ClipboardList },
  { id: "calendar", label: "Booking calendar", icon: CalendarDays },
  { id: "sales", label: "Sales", icon: Banknote },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "customers", label: "Customers", icon: UsersIcon },
  { id: "courts", label: "Court management", icon: LayoutGrid },
  { id: "users", label: "User management", icon: UserCog },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

// Pages a limited "staff" account may access.
const STAFF_PAGES = new Set<Page>(["dashboard", "approvals", "bookings", "calendar", "customers", "courts", "settings"]);

const TITLES: Record<Page, [string, string]> = {
  dashboard: ["Dashboard", "A snapshot of today at the courts"],
  approvals: ["Approvals", "Verify payments and confirm bookings"],
  bookings: ["Bookings", "Every reservation, filterable"],
  calendar: ["Booking calendar", "Who has which court, when"],
  sales: ["Sales", "Revenue performance over time"],
  reports: ["Reports", "Deeper analytics"],
  customers: ["Customers", "Your player directory"],
  courts: ["Court management", "Rates, surfaces & maintenance"],
  settings: ["Settings", "Blackouts & booking policies"],
  users: ["User management", "Create staff and set access"],
};

export default function AdminApp() {
  const { logout, bookings, access, adminName, branding } = useStore();
  const router = useRouter();
  const [page, setPage] = useState<Page>("dashboard");
  // Dev shortcut only — hidden on a deployed console.
  const isLocal = useIsLocal();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const rz = () => setIsMobile(window.innerWidth < 820);
    rz();
    window.addEventListener("resize", rz);
    return () => window.removeEventListener("resize", rz);
  }, []);

  const nav = access === "admin" ? NAV : NAV.filter((n) => STAFF_PAGES.has(n.id));
  // If a staff account is on a page it can't access, send it back to the dashboard.
  useEffect(() => {
    if (access === "staff" && !STAFF_PAGES.has(page)) setPage("dashboard");
  }, [access, page]);

  // Blocks the console until first-run setup is finished. Admin-only: a staff
  // account can't complete it, so showing them an unfinishable modal would trap
  // them — they get a plain notice instead.
  const needsOnboarding = branding.onboardingComplete === false;

  const pending = bookings.filter((b) => b.status === "pending_approval").length;
  const [title, subtitle] = TITLES[page];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  if (needsOnboarding && access !== "admin") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Setup not finished</div>
          <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
            An admin still needs to finish setting up this facility before the console can be used.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: isMobile ? "column" : "row" }}>
      {needsOnboarding && <Onboarding />}
      {!isMobile && (
        <aside style={{ width: 238, flexShrink: 0, background: C.dark, color: "#cde3d7", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 11, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ position: "relative", width: 36, height: 36, borderRadius: 11, background: C.greenGrad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BrandMark size={20} />
              </div>
            )}
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: "#fff" }}>{branding.appName}</div>
              <div style={{ fontSize: 10.5, color: "#6f8a7c", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", marginTop: 3 }}>Admin console</div>
            </div>
          </div>
          <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3, overflowY: "auto" }}>
            {nav.map((n) => {
              const Icon = n.icon;
              const active = page === n.id;
              return (
                <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: FONT_DISPLAY, fontSize: 13.5, fontWeight: 600, textAlign: "left", background: active ? "rgba(34,197,94,.15)" : "transparent", color: active ? "#4ade80" : "#8ba396" }}>
                  <Icon style={{ width: 18, height: 18 }} strokeWidth={1.9} />
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {n.id === "approvals" && pending > 0 && (
                    <span style={{ minWidth: 20, height: 20, padding: "0 6px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "#f59e0b", color: C.dark, fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11 }}>{pending}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column", gap: 6 }}>
            {isLocal && (
              <button onClick={() => router.push("/login")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 12px", borderRadius: 11, background: "rgba(255,255,255,.05)", color: "#cde3d7", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                <span style={{ fontSize: 14 }}>↷</span> View customer app
              </button>
            )}
            <button onClick={() => { logout(); router.push("/admin/login"); }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 12px", borderRadius: 11, background: "transparent", color: "#8ba396", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
              <LogOut style={{ width: 15, height: 15 }} /> Sign out
            </button>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}` }}>
          {isMobile ? (
            <>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border3}`, display: "flex", alignItems: "center", gap: 10 }}>
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="" style={{ width: 30, height: 30, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: C.greenGrad, display: "flex", alignItems: "center", justifyContent: "center" }}><BrandMark size={16} /></div>
                )}
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16 }}>{branding.appName} <span style={{ color: C.faint, fontWeight: 500 }}>Admin</span></div>
                {isLocal && (
                  <button onClick={() => router.push("/login")} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Customer app ↷</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 16px" }}>
                {nav.map((n) => {
                  const active = page === n.id;
                  return (
                    <button key={n.id} onClick={() => setPage(n.id)} style={{ flexShrink: 0, padding: "9px 15px", borderRadius: 11, border: `1px solid ${active ? C.green : C.border}`, background: active ? C.dark : "#fff", color: active ? "#fff" : "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {n.label}{n.id === "approvals" && pending > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: "#f59e0b", padding: "1px 6px", borderRadius: 999 }}>{pending}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            // Same cap/centring as <main> so the title lines up with the content.
            <div style={{ padding: "16px 26px", display: "flex", alignItems: "center", gap: 16, maxWidth: CONTENT_MAX, width: "100%", margin: "0 auto" }}>
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, letterSpacing: "-.01em" }}>{title}</div>
                <div style={{ fontSize: 13, color: C.muted2, marginTop: 2 }}>{subtitle}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 13, color: C.muted, fontWeight: 500, padding: "8px 14px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 11 }}>{today}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 13px 5px 5px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 999 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#334155,#0f172a)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 11, color: "#fff" }}>{initials(adminName)}</div>
                  <div style={{ lineHeight: 1.1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.slate }}>{adminName}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: access === "admin" ? C.green : C.indigoInk }}>{access === "admin" ? "Admin" : "Staff"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Capped and centred: on a wide screen the content would otherwise
            hug the left edge with dead space to the right. */}
        <main style={{ flex: 1, padding: isMobile ? "18px 16px 60px" : "22px 26px 60px", maxWidth: CONTENT_MAX, width: "100%", margin: "0 auto" }}>
          {page === "dashboard" && <Dashboard onGoto={setPage} isMobile={isMobile} />}
          {page === "approvals" && <Approvals />}
          {page === "bookings" && <Bookings isMobile={isMobile} />}
          {page === "calendar" && <AdminCalendar />}
          {page === "sales" && access === "admin" && <Sales />}
          {page === "reports" && access === "admin" && <Reports isMobile={isMobile} />}
          {page === "customers" && <Customers />}
          {page === "courts" && <Courts />}
          {page === "settings" && <Settings isMobile={isMobile} />}
          {page === "users" && access === "admin" && <Users isMobile={isMobile} />}
        </main>
      </div>
    </div>
  );
}
