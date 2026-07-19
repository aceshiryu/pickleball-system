"use client";

import React, { useEffect, useState } from "react";
import { api } from "../lib/api-client";
import { C } from "../lib/theme";

// Fetches a booking's receipt on demand (it's kept out of list payloads) and
// renders it: an image inline, a PDF as a link.
export default function ProofImage({ bookingId, height = 200 }: { bookingId: string; height?: number }) {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api
      .get<{ fileName: string | null; image: string | null; recorded?: boolean; removed?: boolean }>(`/bookings/${bookingId}/proof`)
      .then((r) => { if (alive) { setImage(r.image); setFileName(r.fileName); setRemoved(!!r.removed); setLoading(false); } })
      .catch(() => { if (alive) { setError(true); setLoading(false); } });
    return () => { alive = false; };
  }, [bookingId]);

  const box: React.CSSProperties = {
    height, borderRadius: 14, border: `1px solid ${C.border}`, display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
    textAlign: "center", overflow: "hidden", background: "#f7faf9",
  };

  if (loading) return <div style={box}><span style={{ fontSize: 12, color: C.faint }}>Loading receipt…</span></div>;
  if (error) return <div style={box}><span style={{ fontSize: 12, color: "#e11d48" }}>Couldn&apos;t load receipt.</span></div>;
  // Callers render this only while an image is expected, so reaching here means
  // it genuinely isn't retrievable. State that plainly rather than guessing why.
  if (removed || !image) {
    return (
      <div style={box}>
        <span style={{ fontSize: 12.5, color: C.faint }}>Receipt image unavailable</span>
        {fileName && <span style={{ fontFamily: "monospace", fontSize: 10.5, color: C.muted2, padding: "0 10px", wordBreak: "break-all" }}>{fileName}</span>}
      </div>
    );
  }

  if (image.startsWith("data:application/pdf")) {
    return (
      <a href={image} target="_blank" rel="noreferrer" style={{ ...box, textDecoration: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 24 }}>📄</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>Open PDF receipt</span>
        {fileName && <span style={{ fontSize: 11, color: C.faint, padding: "0 10px", wordBreak: "break-all" }}>{fileName}</span>}
      </a>
    );
  }

  return (
    <a href={image} target="_blank" rel="noreferrer" title="Open full size" style={{ display: "block", cursor: "zoom-in" }}>
      <img src={image} alt={fileName ?? "Payment receipt"} style={{ width: "100%", height, objectFit: "contain", borderRadius: 14, border: `1px solid ${C.border}`, background: "#fff" }} />
    </a>
  );
}
