import type { GarmentType } from "@tshirt/shared-types";
import { PhotoGarmentMockup } from "./PhotoGarmentMockup.js";
import type { GarmentMockupProps } from "./garmentShape.js";

export {
  PRINT_AREAS,
  MOCKUP_WIDTH,
  MOCKUP_HEIGHT,
  MOCKUP_VIEW_BOX,
  MOCKUP_DISPLAY_SCALE,
} from "./garmentShape.js";
export type { PrintAreaRect, GarmentMockupProps } from "./garmentShape.js";
export { PhotoGarmentMockup } from "./PhotoGarmentMockup.js";
export { getFabricShadingOverlayStyle, getGarmentClipMaskStyle } from "./garmentClipMask.js";
export {
  useFabricShadingOverlayStyle,
  useGarmentClipMaskStyle,
  useGarmentSilhouetteUrl,
} from "./useGarmentClipMaskStyle.js";
export { GarmentClippedPrintPreview } from "./GarmentClippedPrintPreview.js";
export type { GarmentClippedPrintPreviewProps } from "./GarmentClippedPrintPreview.js";

export function GarmentMockup({
  garmentType,
  ...props
}: GarmentMockupProps & { garmentType: GarmentType }) {
  return <PhotoGarmentMockup garmentType={garmentType} {...props} />;
}
