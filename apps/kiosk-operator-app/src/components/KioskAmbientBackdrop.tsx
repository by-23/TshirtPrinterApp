import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { readCssNumber } from "../lib/popularPrintScale.js";

/** Only the kiosk home route shows the ambient backdrop (see plan: scope v1). */
const AMBIENT_VISIBLE_PATH = "/kiosk";

interface Orb {
  /** Position as a fraction of the canvas size, so resizing the kiosk frame
   *  doesn't need to rescale every orb individually. Absolute draw radius =
   *  `--ambient-orb-size` × `sizeFactor` (per-orb jitter around the slider). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  sizeFactor: number;
  phase: number;
  hueJitter: number;
}

function getThemeStyleSource(): HTMLElement {
  const kioskRoot = document.querySelector(".kiosk-theme-root");
  return kioskRoot instanceof HTMLElement ? kioskRoot : document.documentElement;
}

/** Hue (0-360) of a `--brand-*`-style hex color token, read live from the theme. */
function readCssHue(varName: string, fallbackHue: number): number {
  const raw = getComputedStyle(getThemeStyleSource()).getPropertyValue(varName).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(raw);
  const hex = match?.[1];
  if (!hex) return fallbackHue;

  const int = Number.parseInt(hex, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function createOrb(): Orb {
  const angle = Math.random() * Math.PI * 2;
  const drift = 0.018 + Math.random() * 0.022;
  return {
    x: Math.random(),
    y: Math.random(),
    vx: Math.cos(angle) * drift,
    vy: Math.sin(angle) * drift,
    // ~0.55…1.4 of the ThemePanel base size, so orbs aren't identical blobs.
    sizeFactor: 0.55 + Math.random() * 0.85,
    phase: Math.random() * Math.PI * 2,
    hueJitter: (Math.random() - 0.5) * 36,
  };
}

function resizeOrbPool(orbs: Orb[], count: number) {
  if (orbs.length > count) {
    orbs.length = count;
  } else {
    while (orbs.length < count) orbs.push(createOrb());
  }
}

/**
 * Home-only ambient backdrop: a frosted-glass layer over a canvas of slowly
 * drifting, color-shifting glow orbs. Mounted once in `KioskShell.tsx` and
 * kept alive across every `/kiosk/*` route — only its opacity toggles when
 * navigating away from home, so the animation is already "warm" on return
 * instead of restarting from a blank canvas.
 *
 * Every tunable (orb count/size/speed, color-shift speed/amplitude, blur, frost
 * opacity, on/off) is a plain CSS custom property from `index.css`, read
 * live every frame — the same mechanism `ThemePanel.tsx` already uses for
 * every other kiosk visual, so its sliders retune this without a rebuild.
 */
export function KioskAmbientBackdrop() {
  const location = useLocation();
  const isVisible = location.pathname === AMBIENT_VISIBLE_PATH;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    function resize() {
      const rect = container!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    function frame(now: number) {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(64, now - lastTime) / 1000;
      lastTime = now;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      const enabled = readCssNumber("--ambient-enabled", 1) > 0.5;
      if (!enabled || width === 0 || height === 0) return;

      const count = Math.max(0, Math.round(readCssNumber("--ambient-orb-count", 8)));
      resizeOrbPool(orbsRef.current, count);

      const speed = readCssNumber("--ambient-orb-speed", 1);
      const baseSize = readCssNumber("--ambient-orb-size", 160);
      const shiftSpeed = readCssNumber("--ambient-color-shift-speed", 1);
      const shiftAmp = readCssNumber("--ambient-color-shift-amp", 0.25);
      const baseHue = readCssHue("--brand-primary", 330);
      const t = now / 1000;

      ctx!.save();
      ctx!.scale(dpr, dpr);
      ctx!.globalCompositeOperation = "lighter";

      for (const orb of orbsRef.current) {
        orb.x += orb.vx * speed * dt;
        orb.y += orb.vy * speed * dt;

        if (orb.x < -0.15) orb.x = 1.15;
        else if (orb.x > 1.15) orb.x = -0.15;
        if (orb.y < -0.15) orb.y = 1.15;
        else if (orb.y > 1.15) orb.y = -0.15;

        const radius = Math.max(8, baseSize * orb.sizeFactor);
        const hue = baseHue + orb.hueJitter + Math.sin(t * shiftSpeed * 0.3 + orb.phase) * shiftAmp * 90;
        const cx = orb.x * width;
        const cy = orb.y * height;
        const gradient = ctx!.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `hsla(${hue}, 85%, 62%, 0.55)`);
        gradient.addColorStop(1, `hsla(${hue}, 85%, 62%, 0)`);
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.restore();
    }

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`kiosk-ambient ${isVisible ? "" : "kiosk-ambient--hidden"}`}
    >
      <div className="kiosk-ambient__base" />
      <canvas ref={canvasRef} className="kiosk-ambient__canvas" />
      <div className="kiosk-ambient__frost" />
    </div>
  );
}
