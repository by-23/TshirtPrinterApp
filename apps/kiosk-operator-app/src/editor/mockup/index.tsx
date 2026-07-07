import type { GarmentType } from "@tshirt/shared-types";
import { TshirtMockup } from "./TshirtMockup.js";
import { HoodieMockup } from "./HoodieMockup.js";
import type { GarmentMockupProps } from "./garmentShape.js";

export {
  PRINT_AREAS,
  MOCKUP_WIDTH,
  MOCKUP_HEIGHT,
  MOCKUP_VIEW_BOX,
  MOCKUP_DISPLAY_SCALE,
} from "./garmentShape.js";
export type { PrintAreaRect, GarmentMockupProps } from "./garmentShape.js";
export { TshirtMockup } from "./TshirtMockup.js";
export { HoodieMockup } from "./HoodieMockup.js";
export { getFabricShadingOverlayStyle, getGarmentClipMaskStyle } from "./garmentClipMask.js";
export {
  useFabricShadingOverlayStyle,
  useGarmentClipMaskStyle,
  useTshirtSilhouetteUrl,
} from "./useGarmentClipMaskStyle.js";
export { GarmentClippedPrintPreview } from "./GarmentClippedPrintPreview.js";
export type { GarmentClippedPrintPreviewProps } from "./GarmentClippedPrintPreview.js";

const MOCKUP_BY_TYPE: Record<GarmentType, (props: GarmentMockupProps) => JSX.Element> = {
  tshirt: TshirtMockup,
  hoodie: HoodieMockup,
};

export function GarmentMockup({
  garmentType,
  ...props
}: GarmentMockupProps & { garmentType: GarmentType }) {
  const Mockup = MOCKUP_BY_TYPE[garmentType];
  return <Mockup {...props} />;
}
