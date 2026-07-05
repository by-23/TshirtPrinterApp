import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { HOME_STATIC_LABELS } from "../lib/homeLabels.js";
import {
  BoltIcon,
  ChevronLeft,
  ChevronRight,
  CrownIcon,
  FlameIcon,
  GamepadIcon,
  PhotoIcon,
  RobotIcon,
  SmileyIcon,
  Sparkles,
  StarIcon,
} from "./icons.js";
import { PopularPrintSlideContent, type PopularPrintItem } from "./PopularPrintSlide.js";

/**
 * Placeholder "popular prints" until the catalog (Stage 3) provides real
 * designs/thumbnails. Each card renders the actual blank t-shirt mockup
 * (`Tshirt_White.png` / `Tshirt_Black.png`, provided by the client) with a
 * placeholder graphic "printed" on the chest — no color emoji (renders as
 * empty boxes on systems without a color emoji font) and no external stock
 * photos, just the real garment art + simple SVG stand-ins.
 *
 * T-shirt mockups and per-slide print images can be swapped live from the
 * Design Panel (stored in localStorage as data URLs until exported).
 *
 * More entries than fit on screen at once (slidesPerView=5): Swiper
 * auto-hides its arrows/dots ("swiper-button-lock") whenever every slide
 * already fits in view, which isn't the carousel look the mockup wants.
 */
const POPULAR_PRINTS: PopularPrintItem[] = [
  { id: "cool-bear", Icon: StarIcon, shirt: "white", color: "#38bdf8", likes: "1.2k" },
  { id: "smiley-drip", Icon: SmileyIcon, shirt: "black", color: "#f8fafc", likes: "987" },
  { id: "synthwave-car", Icon: BoltIcon, shirt: "black", color: "#e879f9", likes: "1.5k" },
  { id: "anime-hero", Icon: FlameIcon, shirt: "white", color: "#fb923c", likes: "2.3k" },
  { id: "marble-bust", Icon: CrownIcon, shirt: "black", color: "#fcd34d", likes: "1.1k" },
  { id: "retro-console", Icon: GamepadIcon, shirt: "white", color: "#fb7185", likes: "860" },
  { id: "gallery-print", Icon: PhotoIcon, shirt: "black", color: "#34d399", likes: "1.4k" },
  { id: "bot-buddy", Icon: RobotIcon, shirt: "white", color: "#a78bfa", likes: "742" },
];

export function Banner() {
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
            modules={[Autoplay, Navigation, Pagination]}
            autoplay={{ delay: 4000, disableOnInteraction: false }}
            navigation={{
              prevEl: ".popular-swiper-prev",
              nextEl: ".popular-swiper-next",
            }}
            pagination={{ clickable: true, el: ".popular-swiper-pagination" }}
            slidesPerView={5}
            spaceBetween={10}
            loop
            className="popular-swiper h-[310px] w-full"
          >
            {POPULAR_PRINTS.map((print) => (
              <SwiperSlide key={print.id}>
                <PopularPrintSlideContent print={print} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="popular-swiper-pagination mt-3" />
      </div>
    </section>
  );
}
