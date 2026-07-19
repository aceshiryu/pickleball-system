"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@shared/lib/store";
import { peso } from "@shared/lib/pricing";
import { C, FONT_DISPLAY, avatarBg, initials } from "@shared/lib/theme";

function fmtJoined(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function Customers() {
  const { customers, bookings } = useStore();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return customers
      .map((c) => ({
        ...c,
        bookings: bookings.filter((b) => b.customerId === c.id).length,
        spend: c.spend ?? 0,
      }))
      .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
      .sort((a, b) => b.spend - a.spend);
  }, [customers, bookings, q]);

  const totalRev = customers.reduce((s, c) => s + (c.spend ?? 0), 0);

  const inp: React.CSSProperties = { border: "none", outline: "none", flex: 1, fontFamily: FONT_DISPLAY, fontSize: 14, background: "transparent", color: C.slate };
  const col = "1.6fr 1.2fr 1fr .8fr";

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 220, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px" }}>
          <span style={{ color: C.faint, fontSize: 15 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone…" style={inp} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Chip label="Players" value={String(customers.length)} />
          <Chip label="Lifetime" value={peso(totalRev)} />
        </div>
      </div>

      {rows.length > 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, overflowX: "auto", boxShadow: "0 1px 2px rgba(16,24,40,.03)" }} className="thin-scroll">
          <div style={{ minWidth: 560 }}>
            <div style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "12px 18px", background: "#f7faf9", borderBottom: `1px solid ${C.border2}`, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: C.faint }}>
              <span>Player</span><span>Contact</span><span>Activity</span><span style={{ textAlign: "right" }}>Total spend</span>
            </div>
            {rows.map((c) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "14px 18px", borderBottom: `1px solid ${C.bg}`, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                  <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, background: avatarBg(initials(c.name)), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, color: "#fff" }}>{initials(c.name)}</div>
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, color: C.ink2 }}>{c.name}</div><div style={{ fontSize: 12, color: C.faint }}>Joined {fmtJoined(c.joinedAt)}</div></div>
                </div>
                <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</div><div style={{ fontSize: 12.5, color: C.faint }}>{c.phone}</div></div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.slate }}>{c.bookings} bookings</div>
                <div style={{ textAlign: "right", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15 }}>{peso(c.spend)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px", background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: "#475569" }}>No players match “{q}”</div>
          <div style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>Try a different name, email, or number.</div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 15px" }}>
      <span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, marginLeft: 4 }}>{value}</span>
    </div>
  );
}
