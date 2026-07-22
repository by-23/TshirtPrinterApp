import { useMemo } from "react";
import type { GarmentSide, GarmentType, PrintAreaRect } from "@tshirt/shared-types";
import { useGarmentMockupImage } from "../../lib/kioskImages.js";
import { getFabricShadingOverlayStyle, getGarmentClipMaskStyle } from "./garmentClipMask.js";

/** Alpha silhouette for clipping — always the white flat-lay photo for this type/side (colors are tinted separately). */
export function useGarmentSilhouetteUrl(garmentType: GarmentType, side: GarmentSide): string {
  return useGarmentMockupImage(garmentType, side);
}

interface GarmentClipStyleOptions {
  imageUrl?: string;
  photoWidth?: number;
  photoHeight?: number;
}

export function useGarmentClipMaskStyle(
  garmentType: GarmentType,
  side: GarmentSide,
  _color: string,
  printArea: PrintAreaRect,
  options?: GarmentClipStyleOptions,
) {
  const silhouetteUrl = useGarmentSilhouetteUrl(garmentType, side);
  const imageUrl = options?.imageUrl || silhouetteUrl;

  return useMemo(
    () =>
      getGarmentClipMaskStyle({
        garmentType,
        side,
        printArea,
        imageUrl,
        photoWidth: options?.photoWidth,
        photoHeight: options?.photoHeight,
      }),
    [garmentType, side, printArea, imageUrl, options?.photoWidth, options?.photoHeight],
  );
}

/** Multiply-blend fabric shading overlay for the design layer — see `getFabricShadingOverlayStyle`. */
export function useFabricShadingOverlayStyle(
  garmentType: GarmentType,
  side: GarmentSide,
  _color: string,
  printArea: PrintAreaRect,
  options?: GarmentClipStyleOptions,
) {
  const silhouetteUrl = useGarmentSilhouetteUrl(garmentType, side);
  const imageUrl = options?.imageUrl || silhouetteUrl;

  return useMemo(
    () =>
      getFabricShadingOverlayStyle({
        garmentType,
        side,
        printArea,
        imageUrl,
        photoWidth: options?.photoWidth,
        photoHeight: options?.photoHeight,
      }),
    [garmentType, side, printArea, imageUrl, options?.photoWidth, options?.photoHeight],
  );
}
