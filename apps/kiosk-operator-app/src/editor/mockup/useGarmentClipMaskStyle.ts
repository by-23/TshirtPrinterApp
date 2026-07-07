import { useMemo } from "react";
import type { GarmentSide, GarmentType, PrintAreaRect } from "@tshirt/shared-types";
import {
  DEFAULT_TSHIRT_WHITE,
  DEFAULT_TSHIRT_WHITE_BACK,
  useKioskImage,
} from "../../lib/kioskImages.js";
import { getFabricShadingOverlayStyle, getGarmentClipMaskStyle } from "./garmentClipMask.js";

/** Alpha silhouette for clipping — always uses the white flat-lay photo (colors are tinted separately). */
export function useTshirtSilhouetteUrl(_color: string, side: GarmentSide): string {
  const whiteFront = useKioskImage("tshirt-white") || DEFAULT_TSHIRT_WHITE;
  const whiteBack = useKioskImage("tshirt-white-back") || DEFAULT_TSHIRT_WHITE_BACK;
  return side === "back" ? whiteBack : whiteFront;
}

function useTshirtSilhouetteUrlForClip(
  garmentType: GarmentType,
  color: string,
  side: GarmentSide,
): string | undefined {
  const tshirtImageUrl = useTshirtSilhouetteUrl(color, side);
  return garmentType === "tshirt" ? tshirtImageUrl : undefined;
}

export function useGarmentClipMaskStyle(
  garmentType: GarmentType,
  side: GarmentSide,
  color: string,
  printArea: PrintAreaRect,
) {
  const tshirtImageUrl = useTshirtSilhouetteUrlForClip(garmentType, color, side);

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

/** Multiply-blend fabric shading overlay for the design layer — see `getFabricShadingOverlayStyle`. */
export function useFabricShadingOverlayStyle(
  garmentType: GarmentType,
  side: GarmentSide,
  color: string,
  printArea: PrintAreaRect,
) {
  const tshirtImageUrl = useTshirtSilhouetteUrlForClip(garmentType, color, side);

  return useMemo(
    () =>
      getFabricShadingOverlayStyle({
        garmentType,
        side,
        printArea,
        tshirtImageUrl: garmentType === "tshirt" ? tshirtImageUrl : undefined,
      }),
    [garmentType, side, printArea, tshirtImageUrl],
  );
}
