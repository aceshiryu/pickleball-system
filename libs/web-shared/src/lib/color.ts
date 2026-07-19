// Brand palette derivation. The admin picks ONE colour (primary) and the rest
// of the palette is computed from it, so the brand can't drift out of tune.

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = ln - c / 2;
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round((v + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r1)}${to(g1)}${to(b1)}`;
}

// Shift lightness by a number of percentage points, keeping hue + saturation.
export function shiftLightness(hex: string, delta: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ ...hsl, l: hsl.l + delta });
}

export function darken(hex: string, factor: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${to(parseInt(m[1], 16) * factor)}${to(parseInt(m[2], 16) * factor)}${to(parseInt(m[3], 16) * factor)}`;
}

// A pale tint of the brand — for accent fills and subtle backgrounds.
export function tint(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ h: hsl.h, s: Math.min(hsl.s, 60), l: 94 });
}

/**
 * The "secondary" brand colour, derived from primary.
 *
 * This token drives the dark chrome (admin sidebar, primary buttons) which
 * carries white text, so it must stay deep enough to keep that legible — it is
 * a *shade* of primary, not a lighter tint. The stock pair proves the intent:
 * primary #16a34a is hue 142, and the shipped secondary #0d1b14 is the same
 * hue family at 35% saturation and 8% lightness. This reproduces that.
 */
export function deriveSecondary(primary: string): string {
  const hsl = hexToHsl(primary);
  if (!hsl) return '#0d1b14';
  return hslToHex({ h: hsl.h, s: Math.min(hsl.s, 35), l: 8 });
}
