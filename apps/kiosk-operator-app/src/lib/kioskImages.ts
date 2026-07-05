import { useEffect, useState } from "react";
import tshirtBlack from "../assets/tshirt-black.png";
import tshirtWhite from "../assets/tshirt-white.png";
import { CATEGORY_HOME_LABELS } from "./homeLabels.js";

export const POPULAR_PRINT_IDS = [
  "cool-bear",
  "smiley-drip",
  "synthwave-car",
  "anime-hero",
  "marble-bust",
  "retro-console",
  "gallery-print",
  "bot-buddy",
] as const;

export type PopularPrintId = (typeof POPULAR_PRINT_IDS)[number];

export const CATEGORY_IMAGE_IDS = [
  "memes",
  "anime_movies",
  "games",
  "text",
  "custom",
  "ai_style",
] as const;

export type CategoryImageId = (typeof CATEGORY_IMAGE_IDS)[number];

export interface KioskImageDefinition {
  key: string;
  label: string;
  defaultUrl: string;
  /** When true, an empty default means "no image yet" (UI falls back to SVG/placeholder). */
  optional?: boolean;
}

export interface KioskImageSection {
  title: string;
  images: KioskImageDefinition[];
}

const POPULAR_IMAGES: KioskImageDefinition[] = [
  { key: "tshirt-white", label: "Футболка белая", defaultUrl: tshirtWhite },
  { key: "tshirt-black", label: "Футболка чёрная", defaultUrl: tshirtBlack },
  ...POPULAR_PRINT_IDS.map((id, index) => ({
    key: `print-${id}`,
    label: `Принт ${index + 1}`,
    defaultUrl: "",
    optional: true,
  })),
];

const CATEGORY_IMAGES: KioskImageDefinition[] = CATEGORY_IMAGE_IDS.map((id) => ({
  key: `category-${id}`,
  label: CATEGORY_HOME_LABELS[id].main,
  defaultUrl: "",
  optional: true,
}));

export const KIOSK_IMAGE_SECTIONS: KioskImageSection[] = [
  { title: "Популярные принты", images: POPULAR_IMAGES },
  { title: "Категории", images: CATEGORY_IMAGES },
];

export const KIOSK_IMAGE_DEFINITIONS: KioskImageDefinition[] = KIOSK_IMAGE_SECTIONS.flatMap(
  (section) => section.images,
);

const IMAGE_BY_KEY = new Map(KIOSK_IMAGE_DEFINITIONS.map((item) => [item.key, item]));
const STORAGE_KEY = "kiosk-image-overrides";

type ImageOverrides = Record<string, string>;

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function loadOverrides(): ImageOverrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ImageOverrides;
  } catch {
    return {};
  }
}

function saveOverrides(overrides: ImageOverrides) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

export function subscribeKioskImages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getKioskImageUrl(key: string): string {
  const definition = IMAGE_BY_KEY.get(key);
  const override = loadOverrides()[key]?.trim();
  if (override) return override;
  const url = definition?.defaultUrl ?? "";
  return url.trim();
}

/** Built-in shirt mockups — use as fallback if override/storage returns empty. */
export const DEFAULT_TSHIRT_WHITE = tshirtWhite;
export const DEFAULT_TSHIRT_BLACK = tshirtBlack;

export function hasKioskImageOverride(key: string): boolean {
  return Boolean(loadOverrides()[key]);
}

export function setKioskImageOverride(key: string, dataUrl: string) {
  if (!IMAGE_BY_KEY.has(key)) return;
  const next = { ...loadOverrides(), [key]: dataUrl };
  saveOverrides(next);
  notifyListeners();
}

export function resetKioskImage(key: string) {
  const next = { ...loadOverrides() };
  delete next[key];
  saveOverrides(next);
  notifyListeners();
}

export function resetAllKioskImages() {
  window.localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
}

/** Re-render when any kiosk image override changes (used by Banner + ThemePanel). */
export function useKioskImage(key: string): string {
  const [, setVersion] = useState(0);

  useEffect(() => subscribeKioskImages(() => setVersion((v) => v + 1)), []);

  return getKioskImageUrl(key);
}

export function useKioskImageOverrides(): ImageOverrides {
  const [overrides, setOverrides] = useState<ImageOverrides>(() => loadOverrides());

  useEffect(() => {
    return subscribeKioskImages(() => setOverrides(loadOverrides()));
  }, []);

  return overrides;
}

export function categoryImageKey(category: CategoryImageId): string {
  return `category-${category}`;
}
