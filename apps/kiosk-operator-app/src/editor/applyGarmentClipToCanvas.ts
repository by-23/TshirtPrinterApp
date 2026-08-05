import type { CSSProperties } from "react";
import type { Canvas } from "fabric";
import type { ControlOverscanInsets } from "./selectionControlOverscan.js";

function applyMaskStyle(el: HTMLElement, maskStyle: CSSProperties) {
  el.style.webkitMaskImage = String(maskStyle.WebkitMaskImage ?? maskStyle.maskImage ?? "");
  el.style.maskImage = String(maskStyle.maskImage ?? "");
  el.style.webkitMaskSize = String(maskStyle.WebkitMaskSize ?? maskStyle.maskSize ?? "");
  el.style.maskSize = String(maskStyle.maskSize ?? "");
  el.style.webkitMaskPosition = String(maskStyle.WebkitMaskPosition ?? maskStyle.maskPosition ?? "");
  el.style.maskPosition = String(maskStyle.maskPosition ?? "");
  el.style.webkitMaskRepeat = String(maskStyle.WebkitMaskRepeat ?? maskStyle.maskRepeat ?? "no-repeat");
  el.style.maskRepeat = String(maskStyle.maskRepeat ?? "no-repeat");
}

function clearMaskStyle(el: HTMLElement) {
  el.style.webkitMaskImage = "";
  el.style.maskImage = "";
  el.style.webkitMaskSize = "";
  el.style.maskSize = "";
  el.style.webkitMaskPosition = "";
  el.style.maskPosition = "";
  el.style.webkitMaskRepeat = "";
  el.style.maskRepeat = "";
}

function applyDesignAreaClip(el: HTMLElement, overscan?: ControlOverscanInsets) {
  if (!overscan) {
    el.style.clipPath = "";
    return;
  }
  el.style.clipPath = `inset(${overscan.top}px ${overscan.right}px ${overscan.bottom}px ${overscan.left}px)`;
}

/**
 * CSS mask on the lower canvas — matches the garment mockup pixel-for-pixel.
 * Controls are drawn separately on the upper canvas (see `installUnmaskedControlsRenderer`)
 * and must not inherit the mask or the design-area inset clip.
 */
export function applyGarmentClipMaskToLowerCanvas(
  canvas: Canvas,
  maskStyle: CSSProperties,
  options?: { controlOverscan?: ControlOverscanInsets },
) {
  canvas.clipPath = undefined;

  for (const object of canvas.getObjects()) {
    object.clipPath = undefined;
    object.dirty = true;
  }

  const lower = canvas.lowerCanvasEl;
  if (!lower) return;

  const hasMask = Boolean(maskStyle.maskImage ?? maskStyle.WebkitMaskImage);
  if (hasMask) {
    applyMaskStyle(lower, maskStyle);
  } else {
    clearMaskStyle(lower);
  }

  // Keep design pixels inside the print-area rect while the canvas bitmap
  // covers the full mockup so selection controls can paint anywhere on it.
  applyDesignAreaClip(lower, options?.controlOverscan);

  if (canvas.upperCanvasEl) {
    clearMaskStyle(canvas.upperCanvasEl);
    canvas.upperCanvasEl.style.clipPath = "";
  }
}

export function clearGarmentClipFromCanvas(canvas: Canvas) {
  canvas.clipPath = undefined;
  if (canvas.lowerCanvasEl) {
    clearMaskStyle(canvas.lowerCanvasEl);
    canvas.lowerCanvasEl.style.clipPath = "";
  }
  if (canvas.upperCanvasEl) {
    clearMaskStyle(canvas.upperCanvasEl);
    canvas.upperCanvasEl.style.clipPath = "";
  }
  for (const object of canvas.getObjects()) {
    object.clipPath = undefined;
  }
}

type CanvasWithInternals = Canvas & {
  _groupSelector?: unknown;
  isDrawingMode?: boolean;
  /** `protected` in fabric's own types (meant for subclasses), but this is exactly the documented way to opt out of the default controls pass — see fabric's own `Canvas#renderControls`. */
  skipControlsDrawing?: boolean;
};

/**
 * Fabric draws selection controls on the lower canvas by default, which would
 * also be clipped by the garment CSS mask / design-area inset. Instead, skip
 * the built-in pass and paint controls onto the upper canvas (unmasked, sized
 * to the full mockup — see `selectionControlOverscan.ts`).
 */
export function installUnmaskedControlsRenderer(canvas: Canvas) {
  const internal = canvas as CanvasWithInternals;
  internal.skipControlsDrawing = true;

  const renderControlsOnTop = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (ctx !== canvas.getContext()) return;
    if (internal._groupSelector || internal.isDrawingMode) return;

    const topCtx = canvas.contextTop;
    canvas.clearContext(topCtx);
    canvas.drawControls(topCtx);
  };

  canvas.on("after:render", renderControlsOnTop);

  return () => {
    canvas.off("after:render", renderControlsOnTop);
    internal.skipControlsDrawing = false;
  };
}

export function snapshotCanvasJson(canvas: Canvas): string {
  return JSON.stringify(canvas.toJSON());
}
