/** CSS vars for `.editor-popular-scroll` — must live on the scrolling element for WebKit pseudo-elements. */
export const POPULAR_SCROLL_CSS_VARS = [
  "--editor-popular-scroll-size",
  "--editor-popular-scroll-track-color",
  "--editor-popular-scroll-track-opacity",
  "--editor-popular-scroll-thumb-color",
  "--editor-popular-scroll-thumb-opacity",
] as const;

export function syncPopularScrollElement(
  element: HTMLElement,
  source: HTMLElement = document.documentElement,
) {
  for (const key of POPULAR_SCROLL_CSS_VARS) {
    const value = getComputedStyle(source).getPropertyValue(key).trim();
    if (value) element.style.setProperty(key, value);
    else element.style.removeProperty(key);
  }
}

export function syncAllPopularScrollElements(source: HTMLElement = document.documentElement) {
  for (const element of document.querySelectorAll(".editor-popular-scroll")) {
    if (element instanceof HTMLElement) syncPopularScrollElement(element, source);
  }
}
