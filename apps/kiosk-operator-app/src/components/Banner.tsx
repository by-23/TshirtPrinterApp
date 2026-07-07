import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { HOME_STATIC_LABELS } from "../lib/homeLabels.js";
import { useKioskImagesRevision } from "../lib/kioskImages.js";
import { usePopularPrintSlides } from "../lib/popularPrints.js";
import { ChevronLeft, ChevronRight, Sparkles } from "./icons.js";
import { PopularPrintSlideContent } from "./PopularPrintSlide.js";

export function Banner() {
  const imageRevision = useKioskImagesRevision();
  const slides = usePopularPrintSlides();

  if (slides.length === 0) {
    return (
      <section className="flex flex-col gap-5">
        <h2
          style={{ color: "var(--brand-primary)" }}
          className="text-center text-[26px] font-extrabold uppercase tracking-wide"
        >
          <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" /> {HOME_STATIC_LABELS.bannerTitle}{" "}
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
        <Sparkles aria-hidden className="inline h-6 w-6 align-[-2px]" /> {HOME_STATIC_LABELS.bannerTitle}{" "}
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
            key={`popular-prints-${imageRevision}`}
            modules={[Autoplay, Navigation, Pagination]}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            navigation={{
              prevEl: ".popular-swiper-prev",
              nextEl: ".popular-swiper-next",
            }}
            pagination={{ clickable: true, el: ".popular-swiper-pagination" }}
            slidesPerView={5}
            spaceBetween={10}
            loop={slides.length > 5}
            observer
            observeParents
            observeSlideChildren
            className="popular-swiper h-[310px] w-full"
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
