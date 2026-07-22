import { useEffect, useState } from "react";

/** Default / fallback height for the home popular-prints carousel (see `--popular-slide-height`). */
export const POPULAR_SLIDE_HEIGHT_PX = 330;

function getThemeStyleSource(): HTMLElement {
  const kioskRoot = document.querySelector(".kiosk-theme-root");
  return kioskRoot instanceof HTMLElement ? kioskRoot : document.documentElement;
}

export function readCssNumber(varName: string, fallback: number): number {
  const raw = getComputedStyle(getThemeStyleSource()).getPropertyValue(varName).trim();
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reactive CSS number custom property — updates when the theme panel changes vars. */
export function useCssNumberVar(varName: string, fallback: number): number {
  const [value, setValue] = useState(() => readCssNumber(varName, fallback));

  useEffect(() => {
    const refresh = () => setValue(readCssNumber(varName, fallback));

    refresh();

    const observer = new MutationObserver(refresh);
    for (const target of [document.documentElement, document.querySelector(".kiosk-theme-root")]) {
      if (target instanceof HTMLElement) {
        observer.observe(target, { attributes: true, attributeFilter: ["style"] });
      }
    }

    return () => observer.disconnect();
  }, [varName, fallback]);

  return value;
}

/** Deterministic 0..1 value from a string — stable per slide id across re-renders. */
export function stableUnitRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(31, hash) + seed.charCodeAt(i);
  }
  return (Math.abs(hash) % 10000) / 10000;
}

/** Random print scale within `--popular-print-scale-min` … `--popular-print-scale-max`. */
export function resolvePopularPrintScale(slideId: string): number {
  const min = readCssNumber("--popular-print-scale-min", 0.8);
  const max = readCssNumber("--popular-print-scale-max", 1.3);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + stableUnitRandom(slideId) * (hi - lo);
}

/** Whole-number slides visible in the home popular-prints carousel. */
export function resolvePopularSlidesPerView(): number {
  return Math.max(1, Math.round(readCssNumber("--popular-slides-per-view", 5)));
}
