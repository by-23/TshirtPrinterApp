import { Outlet, useLocation } from "react-router-dom";
import { LanguageSwitcher } from "./LanguageSwitcher.js";
import { usePageTransitionStore } from "../lib/pageTransitionStore.js";

/**
 * Persistent kiosk chrome: language switcher stays mounted across every
 * `/kiosk/*` route; only page content below animates on navigation.
 */
export function KioskShell() {
  const location = useLocation();
  const transition = usePageTransitionStore((state) => state.type);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="kiosk-theme-root pointer-events-auto absolute z-50"
        style={{ top: "var(--kiosk-lang-top)", right: "var(--kiosk-lang-right)" }}
        aria-label="Переключатель языка"
      >
        <LanguageSwitcher />
      </div>

      <div
        key={location.pathname}
        className={`kiosk-page h-full w-full ${transition === "none" ? "" : `kiosk-page--${transition}`}`}
      >
        <Outlet />
      </div>
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
