import type { BannerSlide } from "../lib/popularPrints.js";
import { resolvePopularPrintScale, useCssNumberVar } from "../lib/popularPrintScale.js";
import { GarmentClippedPrintPreview } from "../editor/mockup/GarmentClippedPrintPreview.js";
import { useKioskImage } from "../lib/kioskImages.js";
import { Heart } from "./icons.js";

/** Slide content only — SwiperSlide must be a direct child of Swiper in Banner.tsx. */
export function PopularPrintSlideContent({ slide }: { slide: BannerSlide }) {
  // Operator-uploaded override only applies to the local fallback catalog
  // (`slide.overrideKey`) — real catalog designs already carry their own
  // `imageUrl` from point-server.
  const overrideImage = useKioskImage(slide.overrideKey ?? "");
  const printImage = overrideImage || slide.imageUrl;
  const printScale = resolvePopularPrintScale(slide.id);
  const slideHeightPx = useCssNumberVar("--popular-slide-height", 310);

  return (
    <div className="popular-slide relative w-full overflow-hidden rounded-[var(--radius-card-sm)]">
      <GarmentClippedPrintPreview
        printImageUrl={printImage || undefined}
        printScale={printScale}
        containerHeightPx={slideHeightPx}
      />
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
