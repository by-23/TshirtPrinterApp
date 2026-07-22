import {
  DEFAULT_TSHIRT_WHITE,
  DEFAULT_TSHIRT_WHITE_BACK,
  useKioskImage,
} from "../../lib/kioskImages.js";
import type { GarmentMockupProps } from "./garmentShape.js";

const WHITE_HEX = "#ffffff";
/** Native editor flat-lay asset ratio — keeps the mockup proportional inside the print-area box. */
const SHIRT_ASPECT_RATIO = "640 / 677";

/**
 * Renders the real client-provided flat-lay garment photo (`tshirt-white.png` /
 * `tshirt-white-back.png`) instead of a drawn shape. Non-white palette colors
 * are achieved by tinting the white photo with a `mix-blend-mode: multiply`
 * overlay clipped to the garment's own alpha silhouette, so folds/shadows stay
 * intact. Pass `imageUrl` to use a different photo (home popular-prints mockup).
 */
export function TshirtMockup({ color, side, className, imageUrl, aspectRatio }: GarmentMockupProps) {
  const whiteFront = useKioskImage("tshirt-white") || DEFAULT_TSHIRT_WHITE;
  const whiteBack = useKioskImage("tshirt-white-back") || DEFAULT_TSHIRT_WHITE_BACK;

  const isWhite = color.toLowerCase() === WHITE_HEX;
  const baseImage = imageUrl ?? (side === "back" ? whiteBack : whiteFront);
  const needsTint = !isWhite;

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className ?? ""}`} aria-hidden>
      <div
        className="relative h-full max-h-full w-full max-w-full"
        style={{ aspectRatio: aspectRatio ?? SHIRT_ASPECT_RATIO }}
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
