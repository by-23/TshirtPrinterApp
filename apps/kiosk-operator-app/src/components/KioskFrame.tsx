import { useEffect, useRef, useState, type ReactNode } from "react";
import { PointServerStatus } from "./PointServerStatus.js";
import { ThemePanel } from "./ThemePanel.js";
import { EditorThemePanel } from "./EditorThemePanel.js";
import { CheckoutThemePanel } from "./CheckoutThemePanel.js";
import { GalleryThemePanel } from "./GalleryThemePanel.js";
import { AiThemePanel } from "./AiThemePanel.js";
import { DevViewSwitcher } from "./DevViewSwitcher.js";
import { useReleaseMode } from "../hooks/useReleaseMode.js";
import { enterReleaseFullscreen } from "../lib/displays.js";
import { isPointDesktop } from "../lib/pointDesktop.js";

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
 *
 * In release/native mode the bezel is removed — the canvas fills a vertical
 * frameless window (Chrome `--app` / fullscreen) and may scale up to the
 * physical display.
 */
export function KioskFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const release = useReleaseMode();

  useEffect(() => {
    function updateScale() {
      const el = containerRef.current;
      if (!el) return;
      const pad = release ? 0 : OUTER_PADDING * 2 + BEZEL_BORDER * 2;
      const availableWidth = el.clientWidth - pad;
      const availableHeight = el.clientHeight - pad;
      const fitted = Math.min(availableWidth / KIOSK_WIDTH, availableHeight / KIOSK_HEIGHT);
      // Dev: never upscale (judge true 1080×1920). Release: fill the monitor.
      const next = release ? fitted : Math.min(fitted, 1);
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
  }, [release]);

  useEffect(() => {
    if (!release) return;
    // Electron already opens frameless fullscreen BrowserWindows.
    if (isPointDesktop()) return;
    void enterReleaseFullscreen();
  }, [release]);

  // Border-box size of the bezel: scaled canvas + the border itself, so the
  // canvas (sized/scaled independently below) exactly fills the space inside
  // the border instead of overflowing it asymmetrically.
  const frameWidth = KIOSK_WIDTH * scale + (release ? 0 : BEZEL_BORDER * 2);
  const frameHeight = KIOSK_HEIGHT * scale + (release ? 0 : BEZEL_BORDER * 2);

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-hidden bg-[#000]"
      style={{ minHeight: "100vh" }}
    >
      <div className={`flex flex-col items-center ${release ? "gap-0" : "gap-2"}`}>
        <div
          className={
            release
              ? "relative overflow-hidden bg-ink-950"
              : "relative overflow-hidden rounded-[28px] border-[6px] border-ink-600 bg-ink-950 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_80px_rgba(0,0,0,0.85)]"
          }
          style={{ width: frameWidth, height: frameHeight }}
        >
          <div
            className="origin-top-left"
            style={{ width: KIOSK_WIDTH, height: KIOSK_HEIGHT, transform: `scale(${scale})` }}
          >
            {children}
          </div>
        </div>
        {!release && (
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-400">
            <span className="select-none">
              Экран киоска · 1080 × 1920 · {Math.round(scale * 100)}%
            </span>
            <span className="text-ink-600" aria-hidden>
              |
            </span>
            <PointServerStatus />
          </div>
        )}
      </div>

      {/* Rendered outside the scaled/transformed kiosk canvas above (on purpose:
          a `transform` on an ancestor would turn this `fixed` panel into one
          that positions relative to that ancestor instead of the real
          viewport), so it stays put and usable at any kiosk zoom level. */}
      {!release && (
        <>
          <ThemePanel />
          <EditorThemePanel />
          <CheckoutThemePanel />
          <GalleryThemePanel />
          <AiThemePanel />
          <DevViewSwitcher />
        </>
      )}
    </div>
  );
}
