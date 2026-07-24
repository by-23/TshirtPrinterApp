import { useEffect, useRef } from "react";
import { useLocation, useNavigationType, useOutlet } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { KioskKeyboardOverlay } from "./KioskKeyboardOverlay.js";
import { KioskAmbientBackdrop } from "./KioskAmbientBackdrop.js";
import { KioskPageTransition } from "./KioskPageTransition.js";
import { ScreensaverOverlay } from "./ScreensaverOverlay.js";
import { initPointStatus, usePointStatusStore } from "../lib/pointStatusStore.js";
import { warmBackgroundRemoval } from "../lib/backgroundRemoval.js";
import {
  resolveKioskNavDirection,
  type PageTransitionDirection,
} from "../lib/pageTransitionStore.js";
import { SCREENSAVER_IDLE_MS, useScreensaverPlaylist } from "../lib/screensaverVideos.js";
import { useKioskIdle } from "../lib/useKioskIdle.js";
import { ClosedScreen } from "../routes/kiosk/ClosedScreen.js";

/**
 * Persistent kiosk chrome: language switcher stays mounted across every
 * `/kiosk/*` route; only page content below animates on navigation.
 *
 * Also gates every `/kiosk/*` route behind the point's synced status
 * (Этап 7) — once an admin closes the point from central-relay, `<Outlet />`
 * is replaced by `<ClosedScreen />` in real time, blocking the editor and
 * checkout without a page reload.
 */
export function KioskShell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const outlet = useOutlet();
  const pointConfig = usePointStatusStore((state) => state.config);
  // `null` (not loaded yet) fails open as "open" — see `pointStatusStore.ts`.
  const isClosed = pointConfig?.status === "closed";

  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef<PageTransitionDirection>("forward");

  // Attract loop (Этап 8): operator-uploaded videos from point-server, with
  // optional bundled files in `src/assets/screensaver/` as fallback.
  const screensaverPlaylist = useScreensaverPlaylist();
  const screensaverEnabled = !isClosed && screensaverPlaylist.length > 0;
  const { active: screensaverActive, dismiss: dismissScreensaver } = useKioskIdle(
    SCREENSAVER_IDLE_MS,
    screensaverEnabled,
  );

  if (location.pathname !== prevPathRef.current) {
    directionRef.current = resolveKioskNavDirection(
      prevPathRef.current,
      location.pathname,
      navigationType,
    );
    prevPathRef.current = location.pathname;
  }

  useEffect(() => {
    initPointStatus();
    // Warm the AI-style background-removal model as soon as the kiosk boots
    // (idle-deferred), so entering `/kiosk/ai` later doesn't pay the cold-start cost.
    warmBackgroundRemoval();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <KioskAmbientBackdrop />

      <div
        className="kiosk-theme-root pointer-events-auto absolute z-50"
        style={{ top: "var(--kiosk-lang-top)", right: "var(--kiosk-lang-right)" }}
        aria-label="Переключатель языка"
      >
        <LanguageSwitcher />
      </div>

      <div className="relative z-10 h-full w-full">
        {isClosed ? (
          <ClosedScreen />
        ) : (
          <KioskPageTransition animKey={location.pathname} direction={directionRef.current}>
            {outlet}
          </KioskPageTransition>
        )}
      </div>

      <KioskKeyboardOverlay />

      {/* Full-screen modals (image picker, etc.) portal here so `absolute inset-0`
          covers the kiosk canvas, not the browser viewport — the canvas lives
          inside KioskFrame's CSS transform, so portalling to `document.body`
          makes overlays spill outside the simulated device bezel. */}
      <div id="kiosk-overlay-root" className="pointer-events-none absolute inset-0 z-[800]" />

      {screensaverActive ? (
        <ScreensaverOverlay videos={screensaverPlaylist} onDismiss={dismissScreensaver} />
      ) : null}
    </div>
  );
}

/** Invisible placeholder — keeps header layout when the real switcher lives in KioskShell. */
export function LanguageSwitcherSlot() {
  return (
    <div aria-hidden className="pointer-events-none invisible">
      <LanguageSwitcher />
    </div>
  );
}
