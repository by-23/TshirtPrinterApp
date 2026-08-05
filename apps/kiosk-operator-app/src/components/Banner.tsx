import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useTranslation } from "react-i18next";
import { getBannerTitle } from "../lib/homeLabels.js";
import { useKioskImagesRevision } from "../lib/kioskImages.js";
import { usePopularPrintSlides } from "../lib/popularPrints.js";
import { useCssNumberVar } from "../lib/popularPrintScale.js";
import { ChevronLeft, ChevronRight, SparkleStar } from "./icons.js";
import { PopularPrintSlideContent } from "./PopularPrintSlide.js";
import { homeThemeSection } from "../routes/kiosk/themeSectionsHome.js";

function PopularBannerTitle({ title }: { title: string }) {
  return (
    <h2 className="popular-banner-title">
      <SparkleStar aria-hidden className="popular-banner-title__icon popular-banner-title__icon--pink" />
      {title}
      <SparkleStar aria-hidden className="popular-banner-title__icon popular-banner-title__icon--cyan" />
    </h2>
  );
}

export function Banner() {
  const { i18n } = useTranslation();
  const bannerTitle = getBannerTitle(i18n.language);
  const imageRevision = useKioskImagesRevision();
  const slides = usePopularPrintSlides();
  const slidesPerView = Math.max(1, Math.round(useCssNumberVar("--popular-slides-per-view", 5)));
  // Positive = shirts overlap; negative = gap between them (Swiper spaceBetween is inverted).
  const shirtOverlapPx = useCssNumberVar("--popular-shirt-overlap", 48);

  if (slides.length === 0) {
    return (
      <section className="flex flex-col gap-5" {...homeThemeSection("popular")}>
        <PopularBannerTitle title={bannerTitle} />
        <p className="text-center text-base text-white/50">
          Добавьте PNG или WebP в папку <code className="text-white/70">src/assets/prints/</code> и обновите страницу.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" {...homeThemeSection("popular")}>
      <PopularBannerTitle title={bannerTitle} />

      <div className="relative">
        <button
          type="button"
          aria-label="Предыдущий популярный принт"
          className="popular-swiper-nav popular-swiper-prev absolute left-[-48px] z-10 flex items-center justify-center"
        >
          <ChevronLeft aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Следующий популярный принт"
          className="popular-swiper-nav popular-swiper-next absolute right-[-48px] z-10 flex items-center justify-center"
        >
          <ChevronRight aria-hidden />
        </button>

        <div className="popular-frame">
          {/* Inner clip: Swiper slides stay overflow-visible for shirt overlap,
              but must never paint over / past the rotating border ring. */}
          <div className="popular-frame-clip">
            <Swiper
              key={`popular-prints-${imageRevision}-${slidesPerView}-${shirtOverlapPx}`}
              modules={[Autoplay, Navigation, Pagination]}
              speed={780}
              autoplay={{ delay: 4200, disableOnInteraction: false }}
              navigation={{
                prevEl: ".popular-swiper-prev",
                nextEl: ".popular-swiper-next",
              }}
              pagination={{ clickable: true, el: ".popular-swiper-pagination" }}
              slidesPerView={slidesPerView}
              spaceBetween={-shirtOverlapPx}
              loop={slides.length > slidesPerView}
              observer
              observeParents
              observeSlideChildren
              className="popular-swiper w-full"
            >
              {slides.map((slide, index) => (
                <SwiperSlide
                  key={slide.id}
                  // Every other shirt sits in front: near / far / near / far…
                  // Tied to slide identity (not .swiper-slide-active) so depth
                  // does not flip while the strip translates.
                  style={{ zIndex: index % 2 === 0 ? 2 : 1 }}
                >
                  <PopularPrintSlideContent slide={slide} index={index} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        <div className="popular-swiper-pagination" />
      </div>
    </section>
  );
}
