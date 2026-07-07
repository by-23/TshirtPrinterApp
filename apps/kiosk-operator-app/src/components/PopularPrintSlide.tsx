import {
  DEFAULT_TSHIRT_BLACK,
  DEFAULT_TSHIRT_WHITE,
  useKioskImage,
} from "../lib/kioskImages.js";
import type { BannerSlide } from "../lib/popularPrints.js";
import { Heart } from "./icons.js";

/** Slide content only — SwiperSlide must be a direct child of Swiper in Banner.tsx. */
export function PopularPrintSlideContent({ slide }: { slide: BannerSlide }) {
  const whiteShirt = useKioskImage("tshirt-white") || DEFAULT_TSHIRT_WHITE;
  const blackShirt = useKioskImage("tshirt-black") || DEFAULT_TSHIRT_BLACK;
  // Operator-uploaded override only applies to the local fallback catalog
  // (`slide.overrideKey`) — real catalog designs already carry their own
  // `imageUrl` from point-server.
  const overrideImage = useKioskImage(slide.overrideKey ?? "");
  const printImage = overrideImage || slide.imageUrl;
  const shirtUrl = slide.shirt === "white" ? whiteShirt : blackShirt;

  return (
    <div className="relative h-[310px] w-full overflow-hidden rounded-[var(--radius-card-sm)]">
      <img
        src={shirtUrl}
        alt=""
        aria-hidden
        style={{ height: "calc(100% * var(--popular-shirt-scale, 1.32))" }}
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
      />
      <div className="absolute inset-x-0 top-[30%] flex justify-center">
        {printImage ? (
          <img
            src={printImage}
            alt=""
            aria-hidden
            className="popular-print-art object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          />
        ) : null}
      </div>
      <span className="popular-likes-badge absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1">
        <Heart
          aria-hidden
          className="popular-likes-heart"
          fill="var(--brand-primary)"
          stroke="var(--brand-primary)"
          strokeWidth={0}
        />
        {slide.heartLabel}
      </span>
    </div>
  );
}
