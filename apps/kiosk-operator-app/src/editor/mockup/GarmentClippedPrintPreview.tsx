import { useEffect, useMemo, useState } from "react";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import { initPrintAreaConfig, usePrintAreaStore } from "../../lib/printAreaStore.js";
import { POPULAR_SLIDE_HEIGHT_PX } from "../../lib/popularPrintScale.js";
import { computeCenteredImageScale } from "../canvasImage.js";
import { TshirtMockup } from "./TshirtMockup.js";
import { HoodieMockup } from "./HoodieMockup.js";
import { MOCKUP_DISPLAY_SCALE, MOCKUP_HEIGHT, MOCKUP_WIDTH } from "./garmentShape.js";
import { useFabricShadingOverlayStyle, useGarmentClipMaskStyle } from "./useGarmentClipMaskStyle.js";

const DEFAULT_GARMENT_COLOR = "#ffffff";

const MOCKUP_BY_TYPE = {
  tshirt: TshirtMockup,
  hoodie: HoodieMockup,
} as const;

export interface GarmentClippedPrintPreviewProps {
  printImageUrl?: string;
  garmentType?: GarmentType;
  side?: GarmentSide;
  color?: string;
  /** CSS var that scales the fitted mockup (default: `--popular-shirt-scale`). */
  mockupScaleVar?: string;
  /** Extra multiplier on the print inside the print area (1 = base editor sizing). */
  printScale?: number;
  /** Slide height used to fit the mockup (default: popular carousel height). */
  containerHeightPx?: number;
  className?: string;
}

function CenteredPrintImage({
  url,
  areaWidthPx,
  areaHeightPx,
  printScale,
}: {
  url: string;
  areaWidthPx: number;
  areaHeightPx: number;
  printScale: number;
}) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const dimensions = useMemo(() => {
    if (!naturalSize) return null;
    const scale = computeCenteredImageScale(
      naturalSize.width,
      naturalSize.height,
      areaWidthPx,
      areaHeightPx,
    );
    return {
      width: naturalSize.width * scale,
      height: naturalSize.height * scale,
    };
  }, [naturalSize, areaWidthPx, areaHeightPx]);

  return (
    <div className="relative h-full w-full">
      <img
        src={url}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={(event) => {
          const img = event.currentTarget;
          setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
        style={
          dimensions
            ? {
                width: dimensions.width * printScale,
                height: dimensions.height * printScale,
              }
            : { opacity: 0 }
        }
      />
    </div>
  );
}

/**
 * Read-only garment mockup with a print clipped to the operator-configured
 * print area and garment silhouette — same rules as the editor canvas.
 */
export function GarmentClippedPrintPreview({
  printImageUrl,
  garmentType = "tshirt",
  side = "front",
  color = DEFAULT_GARMENT_COLOR,
  mockupScaleVar = "--popular-shirt-scale",
  printScale = 1,
  containerHeightPx = POPULAR_SLIDE_HEIGHT_PX,
  className,
}: GarmentClippedPrintPreviewProps) {
  const printAreas = usePrintAreaStore((state) => state.areas);

  useEffect(() => {
    initPrintAreaConfig();
  }, []);

  const printArea = printAreas[garmentType][side];
  const garmentClipMaskStyle = useGarmentClipMaskStyle(garmentType, side, color, printArea);
  const fabricShadingOverlayStyle = useFabricShadingOverlayStyle(garmentType, side, color, printArea);
  const Mockup = MOCKUP_BY_TYPE[garmentType];

  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;
  const canvasWidthPx = printArea.width * MOCKUP_DISPLAY_SCALE;
  const canvasHeightPx = printArea.height * MOCKUP_DISPLAY_SCALE;
  const mockupFitScale = containerHeightPx / mockupPixelHeight;

  return (
    <div className={`flex h-full w-full items-center justify-center overflow-hidden ${className ?? ""}`}>
      <div
        className="relative shrink-0"
        style={{
          width: mockupPixelWidth,
          height: mockupPixelHeight,
          transform: `scale(calc(${mockupFitScale} * var(${mockupScaleVar}, 0.85)))`,
          transformOrigin: "center center",
        }}
      >
        <Mockup side={side} color={color} className="absolute inset-0 h-full w-full" />
        {printImageUrl ? (
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
            <CenteredPrintImage
              url={printImageUrl}
              areaWidthPx={canvasWidthPx}
              areaHeightPx={canvasHeightPx}
              printScale={printScale}
            />
            <div className="absolute inset-0" style={fabricShadingOverlayStyle} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
