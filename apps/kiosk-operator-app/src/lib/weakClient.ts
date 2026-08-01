/**
 * Heuristic for low-power clients (esp. cheap Android kiosk panels over LAN).
 * Switches ambient to a CSS-only path and skips heavy boot warm-ups.
 */
export function isWeakClient(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return true;

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) return true;

  return false;
}
