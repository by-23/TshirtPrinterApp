export interface FontOption {
  id: string;
  label: string;
  family: string;
}

interface GoogleFontSpec {
  id: string;
  label: string;
  /** CSS font-family stack (first face must match Google Fonts family name). */
  family: string;
  /** Name as used in the Google Fonts CSS2 API. */
  google: string;
  weights?: number[];
}

const GOOGLE_FONT_SPECS: GoogleFontSpec[] = [
  {
    id: "inter",
    label: "Inter",
    family: "'Inter', system-ui, sans-serif",
    google: "Inter",
    weights: [400, 600, 700, 800],
  },
  {
    id: "oswald",
    label: "Oswald",
    family: "'Oswald', sans-serif",
    google: "Oswald",
    weights: [400, 600, 700],
  },
  {
    id: "montserrat",
    label: "Montserrat",
    family: "'Montserrat', sans-serif",
    google: "Montserrat",
    weights: [600, 700, 800],
  },
  {
    id: "rubik",
    label: "Rubik",
    family: "'Rubik', sans-serif",
    google: "Rubik",
    weights: [400, 600, 700],
  },
  {
    id: "bebas-neue",
    label: "Bebas Neue",
    family: "'Bebas Neue', sans-serif",
    google: "Bebas Neue",
  },
  {
    id: "roboto",
    label: "Roboto",
    family: "'Roboto', sans-serif",
    google: "Roboto",
    weights: [400, 500, 600, 700, 800, 900],
  },
  {
    id: "roboto-condensed",
    label: "Roboto Condensed",
    family: "'Roboto Condensed', sans-serif",
    google: "Roboto Condensed",
    weights: [400, 500, 600, 700],
  },
  {
    id: "roboto-slab",
    label: "Roboto Slab",
    family: "'Roboto Slab', serif",
    google: "Roboto Slab",
    weights: [400, 700],
  },
  {
    id: "anton",
    label: "Anton",
    family: "'Anton', sans-serif",
    google: "Anton",
  },
  {
    id: "bangers",
    label: "Bangers",
    family: "'Bangers', cursive",
    google: "Bangers",
  },
  {
    id: "permanent-marker",
    label: "Permanent Marker",
    family: "'Permanent Marker', cursive",
    google: "Permanent Marker",
  },
  {
    id: "pacifico",
    label: "Pacifico",
    family: "'Pacifico', cursive",
    google: "Pacifico",
  },
];

const SYSTEM_FONT_OPTIONS: FontOption[] = [
  { id: "system", label: "Системный", family: "system-ui, sans-serif" },
  { id: "segoe", label: "Segoe UI", family: "'Segoe UI', system-ui, sans-serif" },
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif" },
  { id: "georgia", label: "Georgia", family: "Georgia, serif" },
  { id: "impact", label: "Impact", family: "Impact, Haettenschweiler, sans-serif" },
  { id: "courier", label: "Courier", family: "'Courier New', Courier, monospace" },
];

/** Self-hosted faces from `src/assets/fonts` (@font-face in index.css). */
const LOCAL_FONT_OPTIONS: FontOption[] = [
  {
    id: "pt-sans-narrow",
    label: "PT Sans Narrow",
    family: "'PT Sans Narrow', sans-serif",
  },
  {
    id: "barlow-condensed",
    label: "Barlow Condensed",
    family: "'Barlow Condensed', sans-serif",
  },
];

/** Fonts loaded from Google Fonts CDN. */
export const GOOGLE_FONT_OPTIONS: FontOption[] = GOOGLE_FONT_SPECS.map(({ id, label, family }) => ({
  id,
  label,
  family,
}));

/** Theme panel + CSS token picker (system + local + Google). */
export const THEME_FONT_OPTIONS: FontOption[] = [
  ...SYSTEM_FONT_OPTIONS,
  ...LOCAL_FONT_OPTIONS,
  ...GOOGLE_FONT_OPTIONS,
];

/** Canvas text tool — display faces suited for print designs. */
export const EDITOR_FONTS: FontOption[] = [
  LOCAL_FONT_OPTIONS.find((f) => f.id === "pt-sans-narrow")!,
  LOCAL_FONT_OPTIONS.find((f) => f.id === "barlow-condensed")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "roboto")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "roboto-condensed")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "oswald")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "anton")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "bebas-neue")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "bangers")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "permanent-marker")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "pacifico")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "rubik")!,
  GOOGLE_FONT_OPTIONS.find((f) => f.id === "roboto-slab")!,
  SYSTEM_FONT_OPTIONS.find((f) => f.id === "impact")!,
  SYSTEM_FONT_OPTIONS.find((f) => f.id === "courier")!,
];

export const DEFAULT_UI_FONT = "'Roboto', sans-serif";
export const DEFAULT_DISPLAY_FONT = "'Roboto', sans-serif";

function buildGoogleFontsHref(): string {
  const params = GOOGLE_FONT_SPECS.map(({ google, weights }) => {
    const name = google.replace(/ /g, "+");
    if (!weights?.length) return `family=${name}`;
    return `family=${name}:wght@${weights.join(";")}`;
  });

  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

/** Injects Google Fonts stylesheet once (call before first paint when possible). */
export function injectGoogleFonts(): void {
  if (document.getElementById("google-fonts")) return;

  const link = document.createElement("link");
  link.id = "google-fonts";
  link.rel = "stylesheet";
  link.href = buildGoogleFontsHref();
  document.head.appendChild(link);
}

const KIOSK_THEME_STORAGE_KEY = "kiosk-theme-overrides";

/** Applies the UI font saved in ThemePanel localStorage before any route mounts. */
export function applyStoredUiFont(): void {
  try {
    const raw = window.localStorage.getItem(KIOSK_THEME_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, string>;
    const fontFamily = parsed["--font-family"]?.trim();
    if (fontFamily) {
      document.documentElement.style.setProperty("--font-family", fontFamily);
    }
  } catch {
    // Ignore malformed localStorage payloads.
  }
}
