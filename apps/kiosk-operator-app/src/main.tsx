import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import { applyStoredUiFont } from "./lib/fonts.js";
import { setReleaseMode } from "./lib/releaseMode.js";
import "./lib/i18n.js";
import "./index.css";

// Persist release chrome when launched with ?native=1 / ?release=1 so React
// Router navigations (which drop the query string) keep fullscreen / no bezel.
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("native") === "1" || params.get("release") === "1") {
    setReleaseMode(true);
    window.localStorage.removeItem("tshirt.devPanels");
  } else if (params.get("dev") === "1") {
    // Explicit design-tuning session: leave release chrome and keep the gear
    // across SPA navigations / refreshes that drop the query string.
    setReleaseMode(false);
    window.localStorage.setItem("tshirt.devPanels", "1");
  } else if (params.get("dev") === "0") {
    window.localStorage.removeItem("tshirt.devPanels");
  } else if (import.meta.env.DEV) {
    // Vite: don't stay stuck in sticky releaseMode from a past ?native=1 test.
    setReleaseMode(false);
  }
} catch {
  // ignore
}

applyStoredUiFont();

function isScrollableAxis(element: HTMLElement, axis: "x" | "y"): boolean {
  const style = getComputedStyle(element);
  const overflow = axis === "y" ? style.overflowY : style.overflowX;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "y" ? element.scrollHeight > element.clientHeight : element.scrollWidth > element.clientWidth;
}

function canConsumeWheel(element: HTMLElement, deltaX: number, deltaY: number): boolean {
  if (deltaY !== 0 && isScrollableAxis(element, "y")) {
    if (deltaY < 0 && element.scrollTop > 0) return true;
    if (deltaY > 0 && element.scrollTop + element.clientHeight < element.scrollHeight) return true;
  }
  if (deltaX !== 0 && isScrollableAxis(element, "x")) {
    if (deltaX < 0 && element.scrollLeft > 0) return true;
    if (deltaX > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth) return true;
  }
  return false;
}

/** Block page scroll while still allowing wheel/touchpad inside overflow containers. */
document.addEventListener(
  "wheel",
  (event) => {
    let node = event.target instanceof Element ? event.target : null;
    while (node) {
      if (node instanceof HTMLElement && canConsumeWheel(node, event.deltaX, event.deltaY)) {
        return;
      }
      node = node.parentElement;
    }
    event.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
