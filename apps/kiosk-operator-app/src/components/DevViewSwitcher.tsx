import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCheckoutStore } from "../lib/checkoutStore.js";

const LAST_KIOSK_PATH_KEY = "tshirt.dev.lastKioskPath";

function readLastKioskPath(): string {
  try {
    const raw = window.sessionStorage.getItem(LAST_KIOSK_PATH_KEY);
    if (raw && raw.startsWith("/kiosk")) return raw;
  } catch {
    // ignore
  }
  return "/kiosk";
}

/**
 * Dev-only convenience — in production the kiosk and operator screens run as
 * two separate Chrome processes on two separate monitors, so there's no such
 * switcher in either mockup. This just makes it easy to jump between the two
 * while developing/demoing on a single machine.
 *
 * Remembers the last kiosk route (and prefers `/kiosk/checkout` while an order
 * is still open) so returning from the operator panel doesn't drop the customer
 * back to the home screen mid-payment.
 */
export function DevViewSwitcher() {
  const location = useLocation();
  const isOperator = location.pathname.startsWith("/operator");
  const hasOpenCheckout = useCheckoutStore((state) => Boolean(state.order && state.garment));
  const lastKioskPathRef = useRef(readLastKioskPath());

  useEffect(() => {
    if (!location.pathname.startsWith("/kiosk")) return;
    lastKioskPathRef.current = location.pathname;
    try {
      window.sessionStorage.setItem(LAST_KIOSK_PATH_KEY, location.pathname);
    } catch {
      // ignore
    }
  }, [location.pathname]);

  // Keep checkout open across operator round-trips until the order is accepted
  // (AcceptedNotice) or cancelled — otherwise "Киоск" always jumps to home.
  const kioskReturnTo = hasOpenCheckout ? "/kiosk/checkout" : lastKioskPathRef.current;

  return (
    <div
      className="fixed bottom-3 right-3 z-[999] flex items-center gap-1 rounded-full bg-black/80 p-1 text-xs font-semibold shadow-lg backdrop-blur-sm"
      style={{ border: "1px solid rgba(255,255,255,0.15)" }}
    >
      <Link
        to={isOperator ? kioskReturnTo : location.pathname}
        className="rounded-full px-3 py-1.5 transition-colors"
        style={{ backgroundColor: isOperator ? "transparent" : "#ff2d95", color: "#fff" }}
      >
        Киоск
      </Link>
      <Link
        to="/operator"
        className="rounded-full px-3 py-1.5 transition-colors"
        style={{ backgroundColor: isOperator ? "#ff2d95" : "transparent", color: "#fff" }}
      >
        Оператор
      </Link>
    </div>
  );
}
