/**
 * Design/theme panels (settings gear) are opt-in only.
 * Release / Android / plain `/kiosk` never show them — open `?dev=1` when tuning.
 */
export function showDevDesignPanels(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "1") return true;
    if (window.localStorage.getItem("tshirt.devPanels") === "1") return true;
  } catch {
    // ignore
  }
  return false;
}
