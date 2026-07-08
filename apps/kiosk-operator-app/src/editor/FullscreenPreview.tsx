import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { StaticCanvas, type Canvas } from "fabric";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import { useEditorStore } from "./store.js";
import { snapshotCanvasJson } from "./applyGarmentClipToCanvas.js";
import { usePrintAreaStore } from "../lib/printAreaStore.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  useFabricShadingOverlayStyle,
  useGarmentClipMaskStyle,
} from "./mockup/index.js";
import { CircleX } from "../components/icons.js";

interface ReadOnlyCanvasProps {
  snapshot: string | null;
  widthPx: number;
  heightPx: number;
}

/** Same non-interactive `StaticCanvas` render approach as `CheckoutPreview.tsx`'s `ReadOnlyCanvas`. */
function ReadOnlyCanvas({ snapshot, widthPx, heightPx }: ReadOnlyCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new StaticCanvas(canvasElRef.current, {
      width: widthPx,
      height: heightPx,
      backgroundColor: "transparent",
    });
    if (snapshot) {
      void canvas.loadFromJSON(snapshot).then(() => canvas.requestRenderAll());
    }
    return () => {
      void canvas.dispose();
    };
  }, [snapshot, widthPx, heightPx]);

  return <canvas ref={canvasElRef} />;
}

interface FullscreenSidePreviewProps {
  garmentType: GarmentType;
  side: GarmentSide;
  color: string;
  snapshot: string | null;
}

function FullscreenSidePreview({ garmentType, side, color, snapshot }: FullscreenSidePreviewProps) {
  const { t } = useTranslation();
  const printAreas = usePrintAreaStore((state) => state.areas);
  const printArea = printAreas[garmentType][side];
  const garmentClipMaskStyle = useGarmentClipMaskStyle(garmentType, side, color, printArea);
  const fabricShadingOverlayStyle = useFabricShadingOverlayStyle(garmentType, side, color, printArea);
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;
  const canvasWidthPx = printArea.width * MOCKUP_DISPLAY_SCALE;
  const canvasHeightPx = printArea.height * MOCKUP_DISPLAY_SCALE;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative"
        style={{ width: mockupPixelWidth * 0.6, height: mockupPixelHeight * 0.6 }}
      >
        <div
          className="absolute left-0 top-0"
          style={{ width: mockupPixelWidth, height: mockupPixelHeight, transform: "scale(0.6)", transformOrigin: "top left" }}
        >
          <GarmentMockup garmentType={garmentType} side={side} color={color} className="absolute inset-0 h-full w-full" />
          <div
            className="absolute overflow-hidden"
            style={{
              left: printArea.x * MOCKUP_DISPLAY_SCALE,
              top: printArea.y * MOCKUP_DISPLAY_SCALE,
              width: canvasWidthPx,
              height: canvasHeightPx,
              ...garmentClipMaskStyle,
            }}
          >
            <ReadOnlyCanvas snapshot={snapshot} widthPx={canvasWidthPx} heightPx={canvasHeightPx} />
            <div className="absolute inset-0" style={fabricShadingOverlayStyle} />
          </div>
        </div>
      </div>
      <span className="text-lg font-bold uppercase tracking-wide text-white">{t(`editor.sides.${side}`)}</span>
    </div>
  );
}

export interface FullscreenPreviewProps {
  canvas: Canvas | null;
  onClose: () => void;
}

/**
 * Custom fullscreen mode (decision: not the browser Fullscreen API) — a
 * portalled overlay showing both print sides at once, entirely read-only.
 * The currently active side's snapshot is taken fresh from the live canvas
 * on open (`store.canvasSnapshots` only gets updated on side-switch/unmount,
 * see `FabricCanvas.tsx`, so it can lag behind unsaved edits on the side
 * that's on screen right now); the other side comes straight from the store.
 */
export function FullscreenPreview({ canvas, onClose }: FullscreenPreviewProps) {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const color = useEditorStore((state) => state.color);
  const activeSide = useEditorStore((state) => state.side);
  const canvasSnapshots = useEditorStore((state) => state.canvasSnapshots);
  const [liveSnapshot, setLiveSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (canvas) setLiveSnapshot(snapshotCanvasJson(canvas));
    // Intentionally captured once on open — this is a static preview, not a live mirror.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const otherSide: GarmentSide = activeSide === "front" ? "back" : "front";
  const snapshotBySide: Record<GarmentSide, string | null> = {
    [activeSide]: liveSnapshot ?? canvasSnapshots[activeSide],
    [otherSide]: canvasSnapshots[otherSide],
  } as Record<GarmentSide, string | null>;

  return createPortal(
    <button
      type="button"
      onClick={onClose}
      aria-label={t("editor.closeFullscreen")}
      className="fixed inset-0 z-[950] flex cursor-pointer flex-col items-center justify-center gap-10 border-0 bg-black p-10"
    >
      <span className="pointer-events-none absolute right-8 top-8 flex items-center gap-2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
        <CircleX className="h-5 w-5" />
        {t("editor.closeFullscreen")}
      </span>

      <div className="pointer-events-none flex flex-wrap items-start justify-center gap-16">
        <FullscreenSidePreview garmentType={garmentType} side="front" color={color} snapshot={snapshotBySide.front} />
        <FullscreenSidePreview garmentType={garmentType} side="back" color={color} snapshot={snapshotBySide.back} />
      </div>
    </button>,
    document.body,
  );
}
