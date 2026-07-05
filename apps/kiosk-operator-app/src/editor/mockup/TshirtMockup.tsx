import { DEFAULT_TSHIRT_BLACK, DEFAULT_TSHIRT_WHITE, useKioskImage } from "../../lib/kioskImages.js";
import type { GarmentMockupProps } from "./garmentShape.js";

const WHITE_HEX = "#ffffff";
const BLACK_HEX = "#111111";

/**
 * Renders the real client-provided flat-lay garment photo (`tshirt-white.png` /
 * `tshirt-black.png` — the same asset used on the kiosk home banner) instead
 * of a drawn shape. Any other palette color is achieved by tinting the white
 * photo with a `mix-blend-mode: multiply` overlay clipped to the garment's
 * own alpha silhouette, so folds/shadows stay intact — no new artwork is
 * generated, only these two existing images are ever used.
 */
export function TshirtMockup({ color, className }: GarmentMockupProps) {
  const whiteShirt = useKioskImage("tshirt-white") || DEFAULT_TSHIRT_WHITE;
  const blackShirt = useKioskImage("tshirt-black") || DEFAULT_TSHIRT_BLACK;

  const normalizedColor = color.toLowerCase();
  const isBlack = normalizedColor === BLACK_HEX;
  const isWhite = normalizedColor === WHITE_HEX;
  const baseImage = isBlack ? blackShirt : whiteShirt;

  return (
    <div className={`relative ${className ?? ""}`} aria-hidden>
      <img
        src={baseImage}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
      />
      {!isBlack && !isWhite && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: color,
            mixBlendMode: "multiply",
            WebkitMaskImage: `url(${baseImage})`,
            maskImage: `url(${baseImage})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  );
}
