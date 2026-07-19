"use client";

import { useEffect } from "react";
import { useStore } from "../lib/store";
import { fontByKey } from "../lib/fonts";
import { darken, deriveSecondary, tint } from "../lib/color";

export default function BrandingStyle() {
  const { branding } = useStore();
  useEffect(() => {
    const root = document.documentElement;
    const p = branding.primary || "#6B2B2B";
    // Prefer the facility's chosen secondary; fall back to a dark tone derived
    // from primary when it's unset (older rows saved before secondary was a
    // brand field). Secondary is always rendered behind white text, so a
    // facility picking an unreadably light value is the one risk — see the
    // AA note on settings.entity.ts's secondary column.
    const s = branding.secondary || deriveSecondary(p);
    const pd = darken(p, 0.82);
    root.style.setProperty("--brand-primary", p);
    root.style.setProperty("--brand-primary-d", pd);
    root.style.setProperty("--brand-secondary", s);
    root.style.setProperty("--brand-tint", tint(p));
    root.style.setProperty("--brand-grad", `linear-gradient(145deg, ${p}, ${pd})`);

    // Fonts: set the vars every inline style resolves through, and pull in the
    // webfont on demand so we don't ship every option to every visitor.
    const font = fontByKey(branding.fontFamily);
    root.style.setProperty("--font-display", font.display);
    root.style.setProperty("--font-body", font.body);
    if (font.google) {
      const href = `https://fonts.googleapis.com/css2?${font.google}&display=swap`;
      let link = document.getElementById("pp-font") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = "pp-font";
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
    }

    document.title = `${branding.appName} — Book courts online`;
  }, [branding]);
  return null;
}
