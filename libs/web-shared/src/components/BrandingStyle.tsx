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
    // Secondary is the "dark chrome" (admin sidebar, secondary buttons, step
    // badges) and is ALWAYS derived from primary — exactly as the onboarding
    // and Settings colour pickers compute it. Deriving here too means the chrome
    // tracks the brand even when the facility keeps the default colour, instead
    // of showing the neutral stored default. The stored `secondary` column is
    // now vestigial for rendering.
    const s = deriveSecondary(p);
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
