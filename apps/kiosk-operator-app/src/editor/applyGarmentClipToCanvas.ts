import type { CSSProperties } from "react";
import type { Canvas } from "fabric";

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

/**
 * CSS mask on the lower canvas — matches the garment mockup pixel-for-pixel.
 * Controls are drawn separately on the upper canvas (see `installUnmaskedControlsRenderer`).
 */
export function applyGarmentClipMaskToLowerCanvas(canvas: Canvas, maskStyle: CSSProperties) {
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

  if (canvas.upperCanvasEl) {
    clearMaskStyle(canvas.upperCanvasEl);
  }
}

export function clearGarmentClipFromCanvas(canvas: Canvas) {
  canvas.clipPath = undefined;
  if (canvas.lowerCanvasEl) {
    clearMaskStyle(canvas.lowerCanvasEl);
  }
  if (canvas.upperCanvasEl) {
    clearMaskStyle(canvas.upperCanvasEl);
  }
  for (const object of canvas.getObjects()) {
    object.clipPath = undefined;
  }
}

type CanvasWithInternals = Canvas & {
  _groupSelector?: unknown;
  isDrawingMode?: boolean;
};

/**
 * Fabric draws selection controls on the lower canvas by default, which would
 * also be clipped by the garment CSS mask. Instead, skip the built-in pass and
 * paint controls onto the upper canvas after each lower-canvas render.
 */
export function installUnmaskedControlsRenderer(canvas: Canvas) {
  canvas.skipControlsDrawing = true;

  const renderControlsOnTop = ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (ctx !== canvas.getContext()) return;

    const internal = canvas as CanvasWithInternals;
    if (internal._groupSelector || internal.isDrawingMode) return;

    const topCtx = canvas.contextTop;
    canvas.clearContext(topCtx);
    canvas.drawControls(topCtx);
  };

  canvas.on("after:render", renderControlsOnTop);

  return () => {
    canvas.off("after:render", renderControlsOnTop);
    canvas.skipControlsDrawing = false;
  };
}

export function snapshotCanvasJson(canvas: Canvas): string {
  return JSON.stringify(canvas.toJSON());
}
