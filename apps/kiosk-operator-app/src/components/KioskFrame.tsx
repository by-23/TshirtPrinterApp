import { useEffect, useRef, useState, type ReactNode } from "react";
import { PointServerStatus } from "./PointServerStatus.js";
import { ThemePanel } from "./ThemePanel.js";
import { EditorThemePanel } from "./EditorThemePanel.js";
import { CheckoutThemePanel } from "./CheckoutThemePanel.js";
import { GalleryThemePanel } from "./GalleryThemePanel.js";
import { AiThemePanel } from "./AiThemePanel.js";
import { DevViewSwitcher } from "./DevViewSwitcher.js";

/** Real kiosk touchscreen resolution — every kiosk route is designed pixel-for-pixel at this size. */
export const KIOSK_WIDTH = 1080;
export const KIOSK_HEIGHT = 1920;

const OUTER_PADDING = 24;
// Must match the bezel's `border-[6px]` below. The bezel's inline width/height
// are border-box (Tailwind preflight), so without subtracting this here the
// scaled inner canvas ends up 2×BEZEL_BORDER too big for the space actually
// left inside the border — since scaling uses a top-left origin, that excess
// only ever spills out on the right/bottom, never the left/top, which is why
// the whole kiosk page reads as "shifted right" instead of just clipped evenly.
const BEZEL_BORDER = 6;

/**
 * Simulates the physical kiosk monitor: a fixed 1080×1920 canvas rendered
 * inside a visible device frame, scaled down (never up) to fit whatever
 * window/monitor the developer is testing on. This lets you judge the real
 * on-device layout instead of a stretched/responsive browser layout.
 */
export function KioskFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const el = containerRef.current;
      if (!el) return;
      const availableWidth = el.clientWidth - OUTER_PADDING * 2 - BEZEL_BORDER * 2;
      const availableHeight = el.clientHeight - OUTER_PADDING * 2 - BEZEL_BORDER * 2;
      const next = Math.min(availableWidth / KIOSK_WIDTH, availableHeight / KIOSK_HEIGHT, 1);
      setScale(next > 0 ? next : 1);
    }

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  // Border-box size of the bezel: scaled canvas + the border itself, so the
  // canvas (sized/scaled independently below) exactly fills the space inside
  // the border instead of overflowing it asymmetrically.
  const frameWidth = KIOSK_WIDTH * scale + BEZEL_BORDER * 2;
  const frameHeight = KIOSK_HEIGHT * scale + BEZEL_BORDER * 2;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-[#000]"
      style={{ minHeight: "100vh" }}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className="relative overflow-hidden rounded-[28px] border-[6px] border-ink-600 bg-ink-950 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_80px_rgba(0,0,0,0.85)]"
          style={{ width: frameWidth, height: frameHeight }}
        >
          <div
            className="origin-top-left"
            style={{ width: KIOSK_WIDTH, height: KIOSK_HEIGHT, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
          <span className="select-none">
            Экран киоска · 1080 × 1920 · {Math.round(scale * 100)}%
          </span>
          <span className="text-ink-600" aria-hidden>
            |
          </span>
          <PointServerStatus />
        </div>
      </div>

      {/* Rendered outside the scaled/transformed kiosk canvas above (on purpose:
          a `transform` on an ancestor would turn this `fixed` panel into one
          that positions relative to that ancestor instead of the real
          viewport), so it stays put and usable at any kiosk zoom level. */}
      <ThemePanel />
      {/* Same idea, but scoped to /kiosk/editor and its own block-by-block
          tokens (see EditorThemePanel.tsx). Sits lower so its gear button
          doesn't overlap the main Design Panel's one above it. */}
      <EditorThemePanel />
      {/* Same idea again, scoped to /kiosk/checkout (see CheckoutThemePanel.tsx). */}
      <CheckoutThemePanel />
      {/* Same idea again, scoped to /kiosk/category/:category (see GalleryThemePanel.tsx). */}
      <GalleryThemePanel />
      <AiThemePanel />
      <DevViewSwitcher />
    </div>
  );
}
