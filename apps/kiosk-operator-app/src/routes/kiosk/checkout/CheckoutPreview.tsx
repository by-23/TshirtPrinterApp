import { useEffect, useRef, useState } from "react";
import { StaticCanvas } from "fabric";
import { useTranslation } from "react-i18next";
import { garmentSideSchema, type GarmentSide } from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { RAIL_ICON_CLASS, TshirtIcon } from "../../../components/icons.js";
import { useEditorStore } from "../../../editor/store.js";
import type { CheckoutGarment } from "../../../lib/checkoutStore.js";
import { initPrintAreaConfig, usePrintAreaStore } from "../../../lib/printAreaStore.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  useFabricShadingOverlayStyle,
  useGarmentClipMaskStyle,
} from "../../../editor/mockup/index.js";
import { blockBorderStyle } from "./borderStyle.js";

interface ReadOnlyCanvasProps {
  side: GarmentSide;
  snapshot: string | null;
  widthPx: number;
  heightPx: number;
}

/**
 * Non-interactive Fabric render of a saved side snapshot — a `StaticCanvas`
 * rather than the editor's `Canvas`, since checkout only ever displays the
 * design, never edits it (and must not write back into `editorStore`).
 */
function ReadOnlyCanvas({ side, snapshot, widthPx, heightPx }: ReadOnlyCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<StaticCanvas | null>(null);

  useEffect(() => {
    if (!canvasElRef.current) return;
    const canvas = new StaticCanvas(canvasElRef.current, {
      width: widthPx,
      height: heightPx,
      backgroundColor: "transparent",
    });
    canvasRef.current = canvas;
    if (snapshot) {
      void canvas.loadFromJSON(snapshot).then(() => canvas.requestRenderAll());
    }
    return () => {
      canvasRef.current = null;
      void canvas.dispose();
    };
    // Re-created whenever the previewed side or its snapshot changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, snapshot, widthPx, heightPx]);

  return <canvas ref={canvasElRef} />;
}

export interface CheckoutPreviewProps {
  garment: CheckoutGarment;
}

/**
 * Left-column mockup preview on `/kiosk/checkout` — same `GarmentMockup` +
 * print-area overlay as the editor canvas, but read-only, plus the
 * Перед/Спина pills for browsing both sides if the customer designed both
 * (the order itself only charges for `garment.side`).
 */
export function CheckoutPreview({ garment }: CheckoutPreviewProps) {
  const { t } = useTranslation();
  const [previewSide, setPreviewSide] = useState<GarmentSide>(garment.side);
  const otherSideSnapshot = useEditorStore((state) => state.canvasSnapshots[garment.side === "front" ? "back" : "front"]);
  const printAreas = usePrintAreaStore((state) => state.areas);

  useEffect(() => {
    initPrintAreaConfig();
  }, []);

  const snapshotBySide: Record<GarmentSide, string | null> = {
    [garment.side]: garment.canvasSnapshot,
    [garment.side === "front" ? "back" : "front"]: otherSideSnapshot,
  } as Record<GarmentSide, string | null>;

  const printArea = printAreas[garment.type][previewSide];
  const garmentClipMaskStyle = useGarmentClipMaskStyle(garment.type, previewSide, garment.color, printArea);
  const fabricShadingOverlayStyle = useFabricShadingOverlayStyle(garment.type, previewSide, garment.color, printArea);
  const canvasWidthPx = printArea.width * MOCKUP_DISPLAY_SCALE;
  const canvasHeightPx = printArea.height * MOCKUP_DISPLAY_SCALE;
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;

  return (
    <div
      className="flex w-full flex-col items-center overflow-hidden"
      style={{
        backgroundColor: "var(--checkout-preview-card-bg)",
        ...blockBorderStyle("preview-card"),
        overflow: "hidden",
        gap: "var(--checkout-preview-gap)",
      }}
    >
      <div
        className="flex w-full shrink-0 items-center justify-center overflow-hidden"
        style={{ height: "var(--checkout-preview-mockup-area-height)" }}
      >
        <div
          className="relative shrink-0"
          style={{
            width: `calc(${mockupPixelWidth}px * var(--checkout-preview-scale))`,
            height: `calc(${mockupPixelHeight}px * var(--checkout-preview-scale))`,
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{
              width: mockupPixelWidth,
              height: mockupPixelHeight,
              transform: "scale(var(--checkout-preview-scale))",
              transformOrigin: "top left",
            }}
          >
            <GarmentMockup
              garmentType={garment.type}
              side={previewSide}
              color={garment.color}
              className="absolute inset-0 h-full w-full"
            />
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
              <ReadOnlyCanvas
                side={previewSide}
                snapshot={snapshotBySide[previewSide]}
                widthPx={canvasWidthPx}
                heightPx={canvasHeightPx}
              />
              <div className="absolute inset-0" style={fabricShadingOverlayStyle} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-center" style={{ gap: "var(--checkout-preview-toggle-gap)" }}>
        {garmentSideSchema.options.map((sideOption) => {
          const active = previewSide === sideOption;
          const hasContent = Boolean(snapshotBySide[sideOption]);
          return (
            <PillButton
              key={sideOption}
              active={active}
              disabled={!hasContent && sideOption !== garment.side}
              onClick={() => setPreviewSide(sideOption)}
              icon={<TshirtIcon className={RAIL_ICON_CLASS} />}
              className="px-6"
              style={{
                height: "var(--checkout-preview-toggle-height)",
                borderRadius: "var(--checkout-preview-toggle-radius)",
                fontSize: "var(--checkout-preview-toggle-font-size)",
                backgroundColor: active
                  ? "var(--checkout-preview-toggle-active-bg)"
                  : "var(--checkout-preview-toggle-idle-bg)",
              }}
            >
              {t(`editor.sides.${sideOption}`)}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
