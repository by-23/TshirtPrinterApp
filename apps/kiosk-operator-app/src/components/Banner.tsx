import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { useTranslation } from "react-i18next";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/**
 * Placeholder "popular prints" until the catalog (Stage 3) provides real
 * designs/thumbnails. Layout (card + like badge + dots) matches
 * `docs/ui-mockups/category-select.png`; the artwork itself is a stand-in.
 */
const POPULAR_PRINTS = [
  { id: "cool-bear", emoji: "🐻", gradient: "from-cyan-500 to-blue-700", likes: "1.2k" },
  { id: "smiley-drip", emoji: "🙂", gradient: "from-slate-700 to-slate-900", likes: "987" },
  { id: "synthwave-car", emoji: "🚗", gradient: "from-fuchsia-600 to-purple-800", likes: "1.5k" },
  { id: "anime-hero", emoji: "🥷", gradient: "from-orange-500 to-red-700", likes: "2.3k" },
  { id: "marble-bust", emoji: "🗿", gradient: "from-amber-200 to-amber-500", likes: "1.1k" },
];

export function Banner() {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-center text-lg font-bold uppercase tracking-wide text-neon-pink sm:text-xl">
        <span aria-hidden>✦</span> {t("home.banner.title")} <span aria-hidden>✦</span>
      </h2>

      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        navigation
        pagination={{ clickable: true }}
        slidesPerView={2.2}
        spaceBetween={16}
        loop
        breakpoints={{ 768: { slidesPerView: 4.2 } }}
        className="w-full !pb-8 [--swiper-navigation-color:#ff2d95] [--swiper-pagination-color:#ff2d95] [--swiper-pagination-bullet-inactive-color:#5b6690]"
      >
        {POPULAR_PRINTS.map((print) => (
          <SwiperSlide key={print.id}>
            <div
              className={`relative flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-ink-600 bg-gradient-to-br ${print.gradient} sm:h-40`}
            >
              <span className="text-5xl drop-shadow" aria-hidden>
                {print.emoji}
              </span>
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink-950/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
                <span aria-hidden>❤</span>
                {print.likes}
              </span>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}