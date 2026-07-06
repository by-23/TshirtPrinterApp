/** CSS vars for `.app-scroll` — must live on the scrolling element for WebKit pseudo-elements. */
export const OPERATOR_SCROLL_CSS_VARS = [
  "--operator-scroll-size",
  "--operator-scroll-track-color",
  "--operator-scroll-track-opacity",
  "--operator-scroll-thumb-color",
  "--operator-scroll-thumb-opacity",
] as const;

export function syncOperatorScrollElement(
  element: HTMLElement,
  source: HTMLElement = document.documentElement,
) {
  for (const key of OPERATOR_SCROLL_CSS_VARS) {
    const value = getComputedStyle(source).getPropertyValue(key).trim();
    if (value) element.style.setProperty(key, value);
    else element.style.removeProperty(key);
  }
}

export function syncAllOperatorScrollElements(source: HTMLElement = document.documentElement) {
  for (const element of document.querySelectorAll(".operator-theme-root .app-scroll")) {
    if (element instanceof HTMLElement) syncOperatorScrollElement(element, source);
  }
}
