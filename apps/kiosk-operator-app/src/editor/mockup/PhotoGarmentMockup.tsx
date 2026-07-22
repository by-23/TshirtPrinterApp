import type { GarmentType } from "@tshirt/shared-types";
import { useGarmentMockupImage } from "../../lib/kioskImages.js";
import type { GarmentMockupProps } from "./garmentShape.js";

const WHITE_HEX = "#ffffff";
/** All garment flat-lay assets are square 1024×1024 renders — see `GARMENT_PHOTO_WIDTH/HEIGHT`. */
const GARMENT_ASPECT_RATIO = "1 / 1";

/**
 * Renders the real client-provided flat-lay garment photo (t-shirt, sweatshirt,
 * cap, or shopper — one photo per type/side) instead of a drawn shape.
 * Non-white palette colors are achieved by tinting the white photo with a
 * `mix-blend-mode: multiply` overlay clipped to the garment's own alpha
 * silhouette, so folds/shadows stay intact. Pass `imageUrl` to use a
 * different photo (home popular-prints mockup).
 */
export function PhotoGarmentMockup({
  garmentType,
  color,
  side,
  className,
  imageUrl,
  aspectRatio,
}: GarmentMockupProps & { garmentType: GarmentType }) {
  const libraryImage = useGarmentMockupImage(garmentType, side);

  const isWhite = color.toLowerCase() === WHITE_HEX;
  const baseImage = imageUrl ?? libraryImage;
  const needsTint = !isWhite;

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className ?? ""}`} aria-hidden>
      <div
        className="relative h-full max-h-full w-full max-w-full"
        style={{ aspectRatio: aspectRatio ?? GARMENT_ASPECT_RATIO }}
      >
        <img
          src={baseImage}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        />
        {needsTint && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: color,
              mixBlendMode: "multiply",
              WebkitMaskImage: `url(${baseImage})`,
              maskImage: `url(${baseImage})`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }}
          />
        )}
      </div>
    </div>
  );
}
