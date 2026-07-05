import { create } from "zustand";

export const PAGE_TRANSITION_TYPES = [
  "fade",
  "slide-left",
  "slide-up",
  "scale",
  "blur",
  "none",
] as const;

export type PageTransitionType = (typeof PAGE_TRANSITION_TYPES)[number];

export const PAGE_TRANSITION_LABELS: Record<PageTransitionType, string> = {
  fade: "Плавное появление",
  "slide-left": "Слайд слева",
  "slide-up": "Слайд снизу",
  scale: "Масштаб",
  blur: "Размытие",
  none: "Без анимации",
};

const STORAGE_KEY = "tshirt.pageTransition";

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

interface PageTransitionState {
  type: PageTransitionType;
  setType: (type: PageTransitionType) => void;
}

export const usePageTransitionStore = create<PageTransitionState>((set) => ({
  type: loadStoredType(),
  setType: (type) => {
    window.localStorage.setItem(STORAGE_KEY, type);
    set({ type });
  },
}));
