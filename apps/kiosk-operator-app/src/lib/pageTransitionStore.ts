import { create } from "zustand";

export const PAGE_TRANSITION_TYPES = [
  "fade",
  "slide-left",
  "slide-up",
  "scale",
  "blur",
  "zoom-blur",
  "soft",
  "cover",
  "none",
] as const;

export type PageTransitionType = (typeof PAGE_TRANSITION_TYPES)[number];

export const PAGE_TRANSITION_LABELS: Record<PageTransitionType, string> = {
  fade: "Плавное появление",
  "slide-left": "Слайд в сторону",
  "slide-up": "Слайд снизу",
  scale: "Масштаб",
  blur: "Размытие",
  "zoom-blur": "Зум + размытие",
  soft: "Мягкий (fade + scale)",
  cover: "Шторка снизу",
  none: "Без анимации",
};

export type PageTransitionDirection = "forward" | "back";

/** Hierarchy depth for stack direction when UI uses `<Link>` (PUSH) for "Назад". */
export function kioskRouteDepth(pathname: string): number {
  if (pathname === "/kiosk" || pathname === "/kiosk/") return 0;
  if (pathname.startsWith("/kiosk/category/")) return 1;
  if (pathname.startsWith("/kiosk/ai")) return 1;
  if (pathname.startsWith("/kiosk/editor")) return 2;
  if (pathname.startsWith("/kiosk/checkout")) return 3;
  return 1;
}

export function resolveKioskNavDirection(
  fromPath: string,
  toPath: string,
  navigationType: "POP" | "PUSH" | "REPLACE",
): PageTransitionDirection {
  if (navigationType === "POP") return "back";
  return kioskRouteDepth(toPath) < kioskRouteDepth(fromPath) ? "back" : "forward";
}

export const PAGE_TRANSITION_DURATION_MS = {
  min: 600,
  max: 2700,
  default: 1440,
  step: 60,
} as const;

const STORAGE_KEY = "tshirt.pageTransition";
const DURATION_STORAGE_KEY = "tshirt.pageTransitionDuration";

function loadStoredType(): PageTransitionType {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && PAGE_TRANSITION_TYPES.includes(raw as PageTransitionType)) {
      return raw as PageTransitionType;
    }
  } catch {
    // ignore
  }
  return "slide-left";
}

function loadStoredDuration(): number {
  try {
    const raw = window.localStorage.getItem(DURATION_STORAGE_KEY);
    if (raw != null) {
      const value = Number(raw);
      if (
        Number.isFinite(value) &&
        value >= PAGE_TRANSITION_DURATION_MS.min &&
        value <= PAGE_TRANSITION_DURATION_MS.max
      ) {
        return value;
      }
    }
  } catch {
    // ignore
  }
  return PAGE_TRANSITION_DURATION_MS.default;
}

interface PageTransitionState {
  type: PageTransitionType;
  durationMs: number;
  setType: (type: PageTransitionType) => void;
  setDurationMs: (durationMs: number) => void;
  reset: () => void;
}

export const usePageTransitionStore = create<PageTransitionState>((set) => ({
  type: loadStoredType(),
  durationMs: loadStoredDuration(),
  setType: (type) => {
    window.localStorage.setItem(STORAGE_KEY, type);
    set({ type });
  },
  setDurationMs: (durationMs) => {
    const clamped = Math.min(
      PAGE_TRANSITION_DURATION_MS.max,
      Math.max(PAGE_TRANSITION_DURATION_MS.min, Math.round(durationMs)),
    );
    window.localStorage.setItem(DURATION_STORAGE_KEY, String(clamped));
    set({ durationMs: clamped });
  },
  reset: () => {
    window.localStorage.setItem(STORAGE_KEY, "slide-left");
    window.localStorage.setItem(DURATION_STORAGE_KEY, String(PAGE_TRANSITION_DURATION_MS.default));
    set({ type: "slide-left", durationMs: PAGE_TRANSITION_DURATION_MS.default });
  },
}));

/** CSS class for a one-shot enter animation (legacy helpers / non-stack usage). */
export function pageTransitionClassName(
  type: PageTransitionType,
  direction: PageTransitionDirection = "forward",
): string {
  if (type === "none") return "kiosk-page";
  const mode = direction === "back" ? "exit" : "enter";
  return `kiosk-page kiosk-page--${mode}-${type}`;
}
