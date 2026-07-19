// Curated font pairings an admin can pick from in Brand settings.
// Each option supplies a display face (headings, numbers, buttons) and a body
// face. `google` is the families query appended to fonts.googleapis.com — omit
// it for stacks that need no download.

export interface FontOption {
  key: string;
  label: string;
  note: string;
  display: string;
  body: string;
  google?: string;
}

export const FONTS: FontOption[] = [
  {
    key: "space-grotesk",
    label: "Space Grotesk",
    note: "Default · geometric and sporty",
    display: "'Space Grotesk', sans-serif",
    body: "'Hanken Grotesk', system-ui, sans-serif",
    google: "family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700",
  },
  {
    key: "inter",
    label: "Inter",
    note: "Neutral and highly legible",
    display: "'Inter', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    google: "family=Inter:wght@400;500;600;700",
  },
  {
    key: "poppins",
    label: "Poppins",
    note: "Rounded and friendly",
    display: "'Poppins', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    google: "family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600",
  },
  {
    key: "dm-sans",
    label: "DM Sans",
    note: "Clean and compact",
    display: "'DM Sans', sans-serif",
    body: "'DM Sans', system-ui, sans-serif",
    google: "family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700",
  },
  {
    key: "outfit",
    label: "Outfit",
    note: "Modern and confident",
    display: "'Outfit', sans-serif",
    body: "'Inter', system-ui, sans-serif",
    google: "family=Outfit:wght@400;500;600;700&family=Inter:wght@400;500;600",
  },
  {
    key: "system",
    label: "System",
    note: "No download — fastest",
    display: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    body: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
];

export const DEFAULT_FONT_KEY = "space-grotesk";
export const FONT_KEYS = FONTS.map((f) => f.key);

export function fontByKey(key?: string | null): FontOption {
  return FONTS.find((f) => f.key === key) ?? FONTS[0];
}
