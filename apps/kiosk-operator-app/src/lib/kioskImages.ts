import { useEffect, useState } from "react";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import tshirtWhite from "../assets/tshirt-white.png";
import tshirtWhiteBack from "../assets/tshirt-white-back.png";
import tshirtPopularWhite from "../assets/tshirt-popular-white.png";
import tshirtPopularBlack from "../assets/tshirt-popular-black.png";
import sweatshirtWhite from "../assets/sweatshirt-white.png";
import sweatshirtWhiteBack from "../assets/sweatshirt-white-back.png";
import capWhite from "../assets/cap-white.png";
import capWhiteBack from "../assets/cap-white-back.png";
import shopperWhite from "../assets/shopper-white.png";
import shopperWhiteBack from "../assets/shopper-white-back.png";
import { getCategoryHomeLabel } from "./homeLabels.js";
import {
  clearAllImageOverrides,
  deleteImageOverride,
  ensureKioskImageStoreReady,
  getCachedImageUrl,
  getOverrideKeys,
  hasCachedOverride,
  saveImageOverride,
} from "./kioskImageStore.js";
import { PRINT_CATALOG, printImageKey } from "./printCatalog.js";

export type PopularPrintId = string;

export { PRINT_CATALOG, printImageKey, type PrintDefinition } from "./printCatalog.js";

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
  { key: "tshirt-popular-white", label: "Футболка белая (популярные принты)", defaultUrl: tshirtPopularWhite },
  { key: "tshirt-popular-black", label: "Футболка чёрная (популярные принты)", defaultUrl: tshirtPopularBlack },
  { key: "tshirt-white", label: "Футболка белая (перед)", defaultUrl: tshirtWhite },
  { key: "tshirt-white-back", label: "Футболка белая (спина)", defaultUrl: tshirtWhiteBack },
  ...PRINT_CATALOG.map((print, index) => ({
    key: printImageKey(print.id),
    label: `Принт ${index + 1} — ${print.label}`,
    defaultUrl: print.url,
  })),
];

/** Editor mockup photos for the other garment types (home preview stays t-shirt-only). */
const GARMENT_MOCKUP_IMAGES: KioskImageDefinition[] = [
  { key: "sweatshirt-white", label: "Свитшот белый (перед)", defaultUrl: sweatshirtWhite },
  { key: "sweatshirt-white-back", label: "Свитшот белый (спина)", defaultUrl: sweatshirtWhiteBack },
  { key: "cap-white", label: "Кепка белая (перед)", defaultUrl: capWhite },
  { key: "cap-white-back", label: "Кепка белая (спина)", defaultUrl: capWhiteBack },
  { key: "shopper-white", label: "Шоппер белый (перед)", defaultUrl: shopperWhite },
  { key: "shopper-white-back", label: "Шоппер белый (спина)", defaultUrl: shopperWhiteBack },
];

const CATEGORY_IMAGES: KioskImageDefinition[] = CATEGORY_IMAGE_IDS.map((id) => ({
  key: `category-${id}`,
  label: getCategoryHomeLabel(id, "ru").main,
  defaultUrl: "",
  optional: true,
}));

export const KIOSK_IMAGE_SECTIONS: KioskImageSection[] = [
  { title: "Популярные принты", images: POPULAR_IMAGES },
  { title: "Другие изделия", images: GARMENT_MOCKUP_IMAGES },
  { title: "Категории", images: CATEGORY_IMAGES },
];

const CHECKOUT_QR_STEP_IMAGES: KioskImageDefinition[] = [
  {
    key: "checkout-step-openApp",
    label: "Шаг 1 — Откройте приложение банка",
    defaultUrl: "",
    optional: true,
  },
  {
    key: "checkout-step-scanQr",
    label: "Шаг 2 — Отсканируйте QR-код",
    defaultUrl: "",
    optional: true,
  },
  {
    key: "checkout-step-confirmPayment",
    label: "Шаг 3 — Подтвердите оплату",
    defaultUrl: "",
    optional: true,
  },
  {
    key: "checkout-step-orderToPrint",
    label: "Шаг 4 — Заказ отправится в печать",
    defaultUrl: "",
    optional: true,
  },
];

export const CHECKOUT_IMAGE_DEFINITIONS: KioskImageDefinition[] = [
  {
    key: "checkout-cash-illustration",
    label: "Карточка «Оплата в кассу» — картинка",
    defaultUrl: "",
    optional: true,
  },
  ...CHECKOUT_QR_STEP_IMAGES,
];

export const KIOSK_IMAGE_DEFINITIONS: KioskImageDefinition[] = [
  ...KIOSK_IMAGE_SECTIONS.flatMap((section) => section.images),
  ...CHECKOUT_IMAGE_DEFINITIONS,
];

const IMAGE_BY_KEY = new Map(KIOSK_IMAGE_DEFINITIONS.map((item) => [item.key, item]));
const ALLOWED_IMAGE_KEYS = new Set(IMAGE_BY_KEY.keys());

const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

void ensureKioskImageStoreReady(ALLOWED_IMAGE_KEYS).then(() => notifyListeners());

export function subscribeKioskImages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function defaultUrlFor(key: string): string {
  return IMAGE_BY_KEY.get(key)?.defaultUrl ?? "";
}

export function getKioskImageUrl(key: string): string {
  return getCachedImageUrl(key, defaultUrlFor(key));
}

/** Built-in shirt mockups — use as fallback if override/storage returns empty. */
export const DEFAULT_TSHIRT_WHITE = tshirtWhite;
export const DEFAULT_TSHIRT_WHITE_BACK = tshirtWhiteBack;
/** Home "Популярные принты" carousel mockups — separate white/black photos. */
export const DEFAULT_TSHIRT_POPULAR_WHITE = tshirtPopularWhite;
export const DEFAULT_TSHIRT_POPULAR_BLACK = tshirtPopularBlack;

/** Built-in per-type white flat-lay key, e.g. `sweatshirt-white-back` — mirrors `GARMENT_MOCKUP_IMAGES`/`POPULAR_IMAGES` keys above. */
export function garmentImageKey(type: GarmentType, side: GarmentSide): string {
  return side === "back" ? `${type}-white-back` : `${type}-white`;
}

const DEFAULT_GARMENT_IMAGE_BY_KEY: Record<string, string> = {
  "tshirt-white": tshirtWhite,
  "tshirt-white-back": tshirtWhiteBack,
  "sweatshirt-white": sweatshirtWhite,
  "sweatshirt-white-back": sweatshirtWhiteBack,
  "cap-white": capWhite,
  "cap-white-back": capWhiteBack,
  "shopper-white": shopperWhite,
  "shopper-white-back": shopperWhiteBack,
};

/** Re-render when the operator overrides this garment's mockup photo, same as `useKioskImage`. */
export function useGarmentMockupImage(type: GarmentType, side: GarmentSide): string {
  const key = garmentImageKey(type, side);
  return useKioskImage(key) || DEFAULT_GARMENT_IMAGE_BY_KEY[key] || "";
}

export function hasKioskImageOverride(key: string): boolean {
  return hasCachedOverride(key);
}

export async function setKioskImageOverride(key: string, source: Blob | File | string): Promise<boolean> {
  if (!IMAGE_BY_KEY.has(key)) return false;
  const saved = await saveImageOverride(key, source);
  if (!saved) return false;
  notifyListeners();
  return true;
}

export function resetKioskImage(key: string) {
  void deleteImageOverride(key).then(() => notifyListeners());
}

export function resetAllKioskImages() {
  void clearAllImageOverrides().then(() => notifyListeners());
}

function useKioskImageStoreVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void ensureKioskImageStoreReady(ALLOWED_IMAGE_KEYS).then(() => {
      if (!cancelled) setVersion((value) => value + 1);
    });

    return subscribeKioskImages(() => setVersion((value) => value + 1));
  }, []);

  return version;
}

/** Re-render when any kiosk image override changes (used by Banner + ThemePanel). */
export function useKioskImage(key: string): string {
  useKioskImageStoreVersion();
  return getKioskImageUrl(key);
}

/** Keys of images replaced via the design panel (values live in IndexedDB, not here). */
export function useKioskImageOverrides(): ReadonlySet<string> {
  const [overrideKeys, setOverrideKeys] = useState<ReadonlySet<string>>(() => getOverrideKeys());

  useEffect(() => {
    let cancelled = false;

    void ensureKioskImageStoreReady(ALLOWED_IMAGE_KEYS).then(() => {
      if (!cancelled) setOverrideKeys(getOverrideKeys());
    });

    return subscribeKioskImages(() => setOverrideKeys(getOverrideKeys()));
  }, []);

  return overrideKeys;
}

export function categoryImageKey(category: CategoryImageId): string {
  return `category-${category}`;
}

export function checkoutCashIllustrationKey(): string {
  return "checkout-cash-illustration";
}

export type CheckoutQrStepId =
  | "openApp"
  | "scanQr"
  | "confirmPayment"
  | "orderToPrint";

export function checkoutStepImageKey(step: CheckoutQrStepId): string {
  return `checkout-step-${step}`;
}

export function popularPrintImageKey(id: PopularPrintId): string {
  return printImageKey(id);
}

/** Bump when any kiosk image override changes (e.g. remount Swiper loop clones). */
export function useKioskImagesRevision(): number {
  return useKioskImageStoreVersion();
}
