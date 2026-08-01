import type { CSSProperties } from "react";
import type { GarmentType } from "@tshirt/shared-types";
import { useGarmentMockupImage } from "../../lib/kioskImages.js";
import type { GarmentMockupProps } from "./garmentShape.js";

const WHITE_HEX = "#ffffff";
/** All garment flat-lay assets are square 1024×1024 renders — see `GARMENT_PHOTO_WIDTH/HEIGHT`. */
const GARMENT_ASPECT_RATIO = "1 / 1";

/**
 * Renders the real client-provided flat-lay garment photo (t-shirt, sweatshirt,
 * cap, or shopper — one photo per type/side) instead of a drawn shape.
 *
 * Flat-lay PNGs are near-white in RGB with folds stored in alpha. Non-white
 * colors are a solid fill clipped to that alpha (same end state as sharp's
 * white×multiply + dest-in on the server). Using `mix-blend-mode: multiply`
 * against the dark editor backdrop made opaque fabric darker than the
 * semi-transparent folds — a false "negative" look.
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
        {needsTint ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: color,
              WebkitMaskImage: `url(${baseImage})`,
              maskImage: `url(${baseImage})`,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              ...({ WebkitMaskMode: "alpha", maskMode: "alpha" } as CSSProperties),
            }}
          />
        ) : (
          <img
            src={baseImage}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          />
        )}
      </div>
    </div>
  );
}
