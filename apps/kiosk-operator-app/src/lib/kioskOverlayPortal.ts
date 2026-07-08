/** Portal target for full-screen overlays that must stay inside the 1080×1920 kiosk canvas (see `KioskShell.tsx`). */
export const KIOSK_OVERLAY_ROOT_ID = "kiosk-overlay-root";

export function getKioskOverlayRoot(): HTMLElement {
  return document.getElementById(KIOSK_OVERLAY_ROOT_ID) ?? document.body;
}
