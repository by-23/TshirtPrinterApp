import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { usePageTransitionStore } from "../lib/pageTransitionStore.js";
import { initPointStatus, usePointStatusStore } from "../lib/pointStatusStore.js";
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
  const transition = usePageTransitionStore((state) => state.type);
  const pointConfig = usePointStatusStore((state) => state.config);
  // `null` (not loaded yet) fails open as "open" — see `pointStatusStore.ts`.
  const isClosed = pointConfig?.status === "closed";

  useEffect(() => {
    initPointStatus();
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="kiosk-theme-root pointer-events-auto absolute z-50"
        style={{ top: "var(--kiosk-lang-top)", right: "var(--kiosk-lang-right)" }}
        aria-label="Переключатель языка"
      >
        <LanguageSwitcher />
      </div>

      {isClosed ? (
        <ClosedScreen />
      ) : (
        <div
          key={location.pathname}
          className={`kiosk-page h-full w-full ${transition === "none" ? "" : `kiosk-page--${transition}`}`}
        >
          <Outlet />
        </div>
      )}
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
