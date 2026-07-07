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
import { ChevronLeft, ChevronRight, Sparkles } from "./icons.js";
import { PopularPrintSlideContent } from "./PopularPrintSlide.js";

export function Banner() {
  const { i18n } = useTranslation();
  const bannerTitle = getBannerTitle(i18n.language);
  const imageRevision = useKioskImagesRevision();
  const slides = usePopularPrintSlides();
  const slidesPerView = Math.max(1, Math.round(useCssNumberVar("--popular-slides-per-view", 5)));

  if (slides.length === 0) {
    return (
      <section className="flex flex-col gap-5">
        <h2
          style={{ color: "var(--brand-primary)" }}
          className="text-center text-[26px] font-extrabold uppercase tracking-wide"
        >
          <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" /> {bannerTitle}{" "}
          <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" />
        </h2>
        <p className="text-center text-base text-white/50">
          Добавьте PNG или WebP в папку <code className="text-white/70">src/assets/prints/</code> и обновите страницу.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <h2
        style={{ color: "var(--brand-primary)" }}
        className="text-center text-[26px] font-extrabold uppercase tracking-wide"
      >
        <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" /> {bannerTitle}{" "}
        <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" />
      </h2>

      <div className="relative">
        <button
          type="button"
          aria-label="Предыдущий популярный принт"
          className="popular-swiper-nav popular-swiper-prev absolute left-[-34px] top-1/2 z-10 flex -translate-y-1/2 items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronLeft aria-hidden className="h-6 w-6" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          aria-label="Следующий популярный принт"
          className="popular-swiper-nav popular-swiper-next absolute right-[-34px] top-1/2 z-10 flex -translate-y-1/2 items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronRight aria-hidden className="h-6 w-6" strokeWidth={2.4} />
        </button>

        <div className="popular-frame overflow-hidden px-5 py-0">
          <Swiper
            key={`popular-prints-${imageRevision}-${slidesPerView}`}
            modules={[Autoplay, Navigation, Pagination]}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            navigation={{
              prevEl: ".popular-swiper-prev",
              nextEl: ".popular-swiper-next",
            }}
            pagination={{ clickable: true, el: ".popular-swiper-pagination" }}
            slidesPerView={slidesPerView}
            spaceBetween={10}
            loop={slides.length > slidesPerView}
            observer
            observeParents
            observeSlideChildren
            className="popular-swiper w-full"
          >
            {slides.map((slide) => (
              <SwiperSlide key={slide.id}>
                <PopularPrintSlideContent slide={slide} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="popular-swiper-pagination mt-3" />
      </div>
    </section>
  );
}
