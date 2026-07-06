import { Link, useLocation } from "react-router-dom";

/**
 * Dev-only convenience — in production the kiosk and operator screens run as
 * two separate Chrome processes on two separate monitors, so there's no such
 * switcher in either mockup. This just makes it easy to jump between the two
 * while developing/demoing on a single machine.
 */
export function DevViewSwitcher() {
  const location = useLocation();
  const isOperator = location.pathname.startsWith("/operator");

  return (
    <div
      className="fixed bottom-3 right-3 z-[999] flex items-center gap-1 rounded-full bg-black/80 p-1 text-xs font-semibold shadow-lg backdrop-blur-sm"
      style={{ border: "1px solid rgba(255,255,255,0.15)" }}
    >
      <Link
        to="/kiosk"
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
