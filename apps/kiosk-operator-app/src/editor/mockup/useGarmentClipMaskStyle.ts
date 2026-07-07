import { useMemo } from "react";
import type { GarmentSide, GarmentType, PrintAreaRect } from "@tshirt/shared-types";
import { DEFAULT_TSHIRT_BLACK, DEFAULT_TSHIRT_WHITE, useKioskImage } from "../../lib/kioskImages.js";
import { getGarmentClipMaskStyle } from "./garmentClipMask.js";

const BLACK_HEX = "#111111";

export function useTshirtSilhouetteUrl(color: string): string {
  const whiteShirt = useKioskImage("tshirt-white") || DEFAULT_TSHIRT_WHITE;
  const blackShirt = useKioskImage("tshirt-black") || DEFAULT_TSHIRT_BLACK;
  return color.toLowerCase() === BLACK_HEX ? blackShirt : whiteShirt;
}

function useTshirtSilhouetteUrlForClip(garmentType: GarmentType, color: string): string | undefined {
  const tshirtImageUrl = useTshirtSilhouetteUrl(color);
  return garmentType === "tshirt" ? tshirtImageUrl : undefined;
}

export function useGarmentClipMaskStyle(
  garmentType: GarmentType,
  side: GarmentSide,
  color: string,
  printArea: PrintAreaRect,
) {
  const tshirtImageUrl = useTshirtSilhouetteUrlForClip(garmentType, color);

  return useMemo(
    () =>
      getGarmentClipMaskStyle({
        garmentType,
        side,
        printArea,
        tshirtImageUrl: garmentType === "tshirt" ? tshirtImageUrl : undefined,
      }),
    [garmentType, side, printArea, tshirtImageUrl],
  );
}
