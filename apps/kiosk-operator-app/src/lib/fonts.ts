import {
  BUILTIN_EDITOR_FONTS,
  GOOGLE_FONT_WEIGHTS,
  type ManagedFont,
} from "@tshirt/shared-types";

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
    weights: GOOGLE_FONT_WEIGHTS.Inter,
  },
  {
    id: "oswald",
    label: "Oswald",
    family: "'Oswald', sans-serif",
    google: "Oswald",
    weights: GOOGLE_FONT_WEIGHTS.Oswald,
  },
  {
    id: "montserrat",
    label: "Montserrat",
    family: "'Montserrat', sans-serif",
    google: "Montserrat",
    weights: GOOGLE_FONT_WEIGHTS.Montserrat,
  },
  {
    id: "rubik",
    label: "Rubik",
    family: "'Rubik', sans-serif",
    google: "Rubik",
    weights: GOOGLE_FONT_WEIGHTS.Rubik,
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
    weights: GOOGLE_FONT_WEIGHTS.Roboto,
  },
  {
    id: "roboto-condensed",
    label: "Roboto Condensed",
    family: "'Roboto Condensed', sans-serif",
    google: "Roboto Condensed",
    weights: GOOGLE_FONT_WEIGHTS["Roboto Condensed"],
  },
  {
    id: "roboto-slab",
    label: "Roboto Slab",
    family: "'Roboto Slab', serif",
    google: "Roboto Slab",
    weights: GOOGLE_FONT_WEIGHTS["Roboto Slab"],
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

/** Offline / pre-sync fallback for the canvas text tool. */
export const EDITOR_FONTS: FontOption[] = BUILTIN_EDITOR_FONTS.map(({ id, label, family }) => ({
  id,
  label,
  family,
}));

export const DEFAULT_UI_FONT = "'Roboto', sans-serif";
export const DEFAULT_DISPLAY_FONT = "'Roboto', sans-serif";

function buildGoogleFontsHref(families: string[]): string {
  if (families.length === 0) return "";
  const params = families.map((google) => {
    const name = google.replace(/ /g, "+");
    const weights = GOOGLE_FONT_WEIGHTS[google];
    if (!weights?.length) return `family=${name}`;
    return `family=${name}:wght@${weights.join(";")}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

/** Injects (or replaces) the Google Fonts stylesheet for the given family names. */
export function injectGoogleFonts(googleFamilies?: string[]): void {
  const families =
    googleFamilies ??
    GOOGLE_FONT_SPECS.map((spec) => spec.google);
  const href = buildGoogleFontsHref(families);
  const existing = document.getElementById("google-fonts");

  if (!href) {
    existing?.remove();
    return;
  }

  if (existing instanceof HTMLLinkElement) {
    if (existing.href !== href) existing.href = href;
    return;
  }

  const link = document.createElement("link");
  link.id = "google-fonts";
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

const CUSTOM_FONT_STYLE_ID = "managed-custom-fonts";

/** Primary face name from a CSS `font-family` stack (`'Foo', sans-serif` → `Foo`). */
export function primaryFontFaceName(familyStack: string): string {
  const first = familyStack.split(",")[0]?.trim() ?? familyStack;
  return first.replace(/^['"]|['"]$/g, "");
}

/**
 * Registers custom (synced) font faces via `@font-face` so Fabric can paint
 * them. `fileUrl` is a point-server path (`/files/fonts/...`).
 */
export function injectCustomFontFaces(
  fonts: Array<{ id: string; family: string; fileUrl: string; format?: string }>,
  resolveUrl: (path: string) => string,
): void {
  let style = document.getElementById(CUSTOM_FONT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = CUSTOM_FONT_STYLE_ID;
    document.head.appendChild(style);
  }

  const rules = fonts
    .map((font) => {
      const faceName = primaryFontFaceName(font.family);
      const formatHint = font.format ? ` format("${font.format}")` : "";
      return `@font-face{font-family:'${faceName.replace(/'/g, "\\'")}';src:url("${resolveUrl(font.fileUrl)}")${formatHint};font-display:swap;}`;
    })
    .join("\n");
  style.textContent = rules;
}

/** Applies managed font list: Google CDN + custom @font-face. */
export function applyManagedFonts(
  fonts: ManagedFont[],
  resolveUrl: (path: string) => string,
): FontOption[] {
  const enabled = fonts.filter((font) => font.enabled);
  const googleFamilies = enabled
    .filter((font) => font.kind === "google" && font.googleFamily)
    .map((font) => font.googleFamily!);
  injectGoogleFonts(googleFamilies);

  const custom = enabled.filter(
    (font): font is ManagedFont & { fileUrl: string } =>
      font.kind === "custom" && Boolean(font.fileUrl),
  );
  injectCustomFontFaces(
    custom.map((font) => ({
      id: font.id,
      family: font.family,
      fileUrl: font.fileUrl,
      format: font.format,
    })),
    resolveUrl,
  );

  return enabled.map(({ id, label, family }) => ({ id, label, family }));
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
