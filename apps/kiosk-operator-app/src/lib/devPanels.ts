import { isReleaseMode } from "./releaseMode.js";

/**
 * Design/theme panels (settings gear).
 * - Vite DEV: on by default (unless release/native chrome or `?dev=0`)
 * - Production: only with explicit `?dev=1` (persisted for SPA navigations)
 */
export function showDevDesignPanels(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "0") return false;
    if (params.get("native") === "1" || params.get("release") === "1") return false;
    if (params.get("dev") === "1") return true;
    if (window.localStorage.getItem("tshirt.devPanels") === "1") return true;
    // Vite: show the gear unless this session is in release chrome.
    // main.tsx clears a sticky releaseMode flag on plain DEV loads so a past
    // ?native=1 test doesn't permanently hide the button.
    if (import.meta.env.DEV && !isReleaseMode()) return true;
  } catch {
    // ignore
  }
  return false;
}
