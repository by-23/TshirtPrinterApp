import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useReleaseMode } from "../hooks/useReleaseMode.js";
import { enterReleaseFullscreen } from "../lib/displays.js";
import { isPointDesktop } from "../lib/pointDesktop.js";

/**
 * Reference canvas the operator screen is designed at pixel-for-pixel —
 * exactly 2x `docs/ui-mockups/operator.png` (722×481, rounded to a clean
 * height of 960). The operator monitor's real resolution is unknown, so we
 * scale the canvas by a single, uniform factor derived from the window's
 * HEIGHT only (`window height / 960`) — never independently on X and Y, so
 * nothing ever looks stretched/distorted like a squashed image. The
 * canvas's virtual WIDTH is then computed as `window width / scale`, i.e.
 * exactly enough to fill the window horizontally with no letterboxing bars
 * and no cropping. The fixed-width columns (sidebar/order list/printer
 * panel) keep proportions identical to the mockup; the flexible order
 * details column simply absorbs whatever extra width a wider-than-3:2
 * monitor provides (same idea as any ordinary responsive layout, just
 * scaled uniformly so text/icons/spacing keep the mockup's proportions).
 */
export const OPERATOR_HEIGHT = 960;

const OperatorDevPanels = lazy(() =>
  import("./OperatorDevPanels.js").then((m) => ({ default: m.OperatorDevPanels })),
);

export function OperatorFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ scale: 1, width: 1440 });
  const release = useReleaseMode();

  useEffect(() => {
    function update() {
      const el = containerRef.current;
      if (!el) return;
      const scale = el.clientHeight / OPERATOR_HEIGHT;
      setState({ scale, width: scale > 0 ? el.clientWidth / scale : el.clientWidth });
    }

    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!release) return;
    if (isPointDesktop()) return;
    void enterReleaseFullscreen();
  }, [release]);

  return (
    <div ref={containerRef} className="h-screen w-full overflow-hidden bg-black">
      <div
        className="origin-top-left"
        style={{ width: state.width, height: OPERATOR_HEIGHT, transform: `scale(${state.scale})` }}
      >
        {children}
      </div>

      {/* Rendered outside the scaled/transformed canvas above (on purpose:
          a `transform` on an ancestor would turn this `fixed` panel into one
          that positions relative to that ancestor instead of the real
          viewport) — see the same note in KioskFrame.tsx. */}
      {!release && (
        <Suspense fallback={null}>
          <OperatorDevPanels />
        </Suspense>
      )}
    </div>
  );
}
