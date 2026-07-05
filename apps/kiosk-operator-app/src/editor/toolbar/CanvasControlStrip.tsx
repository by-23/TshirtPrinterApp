import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Canvas, FabricObject } from "fabric";
import { useEditorStore } from "../store.js";

export interface CanvasControlStripProps {
  canvas: Canvas | null;
}

const SCALE_STEP = 1.15;
const ROTATE_STEP = 15;
const OPACITY_STEP = 0.1;

interface ObjectSnapshot {
  scalePercent: number;
  rotationDeg: number;
  opacityPercent: number;
  layerIndex: number;
  layerTotal: number;
}

function readSnapshot(canvas: Canvas | null): ObjectSnapshot | null {
  if (!canvas) return null;
  const active = canvas.getActiveObject();
  if (!active) return null;
  const objects = canvas.getObjects();
  return {
    scalePercent: Math.round((active.scaleX ?? 1) * 100),
    rotationDeg: Math.round(((active.angle ?? 0) % 360) + (active.angle && active.angle < 0 ? 360 : 0)) % 360,
    opacityPercent: Math.round((active.opacity ?? 1) * 100),
    layerIndex: objects.indexOf(active) + 1,
    layerTotal: objects.length,
  };
}

/**
 * Horizontal strip of steppers (size / rotation / opacity / layer) shown
 * under the canvas in `docs/ui-mockups/editor.png`.
 */
export function CanvasControlStrip({ canvas }: CanvasControlStripProps) {
  const { t } = useTranslation();
  const hasSelection = useEditorStore((state) => state.hasSelection);
  const [snapshot, setSnapshot] = useState<ObjectSnapshot | null>(null);

  useEffect(() => {
    if (!canvas) return;
    const refresh = () => setSnapshot(readSnapshot(canvas));
    refresh();
    const events = [
      "selection:created",
      "selection:updated",
      "selection:cleared",
      "object:modified",
      "object:scaling",
      "object:rotating",
    ] as const;
    events.forEach((event) => canvas.on(event, refresh));
    return () => {
      events.forEach((event) => canvas.off(event, refresh));
    };
  }, [canvas]);

  function withActiveObject(action: (active: FabricObject) => void) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    action(active);
    active.setCoords();
    canvas.requestRenderAll();
    setSnapshot(readSnapshot(canvas));
  }

  const display = snapshot ?? { scalePercent: 0, rotationDeg: 0, opacityPercent: 0, layerIndex: 0, layerTotal: 0 };

  const steppers = [
    {
      id: "size",
      label: t("editor.controls.size"),
      value: `${display.scalePercent}%`,
      onDecrease: () =>
        withActiveObject((active) =>
          active.set({ scaleX: active.scaleX / SCALE_STEP, scaleY: active.scaleY / SCALE_STEP }),
        ),
      onIncrease: () =>
        withActiveObject((active) =>
          active.set({ scaleX: active.scaleX * SCALE_STEP, scaleY: active.scaleY * SCALE_STEP }),
        ),
    },
    {
      id: "rotate",
      label: t("editor.controls.rotate"),
      value: `${display.rotationDeg}°`,
      onDecrease: () => withActiveObject((active) => active.set("angle", (active.angle ?? 0) - ROTATE_STEP)),
      onIncrease: () => withActiveObject((active) => active.set("angle", (active.angle ?? 0) + ROTATE_STEP)),
    },
    {
      id: "opacity",
      label: t("editor.controls.opacity"),
      value: `${display.opacityPercent}%`,
      onDecrease: () =>
        withActiveObject((active) => active.set("opacity", Math.max(0, (active.opacity ?? 1) - OPACITY_STEP))),
      onIncrease: () =>
        withActiveObject((active) => active.set("opacity", Math.min(1, (active.opacity ?? 1) + OPACITY_STEP))),
    },
    {
      id: "layer",
      label: t("editor.controls.layer"),
      value: snapshot ? `${display.layerIndex}/${display.layerTotal}` : "—",
      onDecrease: () => {
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.sendObjectBackwards(active);
        canvas.requestRenderAll();
        setSnapshot(readSnapshot(canvas));
      },
      onIncrease: () => {
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.bringObjectForward(active);
        canvas.requestRenderAll();
        setSnapshot(readSnapshot(canvas));
      },
    },
  ];

  const stepperBtnStyle = {
    width: "var(--editor-strip-btn-width)",
    height: "var(--editor-strip-btn-height)",
    borderRadius: "var(--editor-strip-btn-radius)",
    backgroundColor: "var(--editor-strip-btn-bg)",
  };

  return (
    <div
      className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
      style={{
        borderStyle: "solid",
        borderWidth: "var(--editor-strip-border-width)",
        borderRadius: "var(--editor-strip-radius)",
        borderColor:
          "color-mix(in srgb, var(--editor-strip-border-color) calc(var(--editor-strip-border-opacity) * 100%), transparent)",
        backgroundColor: "var(--editor-strip-bg)",
        padding: "var(--editor-strip-padding)",
        height: "var(--editor-strip-height, auto)",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      {steppers.map((stepper) => (
        <div key={stepper.id} className="flex flex-col items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-200">{stepper.label}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={stepper.onDecrease}
              disabled={!hasSelection}
              style={stepperBtnStyle}
              className="flex items-center justify-center text-white transition-colors hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-30"
            >
              −
            </button>
            <span className="w-14 text-center text-base font-semibold text-white">{stepper.value}</span>
            <button
              type="button"
              onClick={stepper.onIncrease}
              disabled={!hasSelection}
              style={stepperBtnStyle}
              className="flex items-center justify-center text-white transition-colors hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
