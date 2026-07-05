import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import { useTranslation } from "react-i18next";
import "swiper/css";

const SLIDE_GRADIENTS = [
  "from-fuchsia-500 to-purple-600",
  "from-orange-400 to-pink-500",
  "from-emerald-400 to-teal-600",
];

export function Banner() {
  const { t } = useTranslation();

  const slides = [
    t("home.banner.newTitle"),
    t("home.banner.popularTitle"),
    t("home.banner.promoTitle"),
  ];

  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{ delay: 4000, disableOnInteraction: false }}
      loop
      className="h-40 w-full overflow-hidden rounded-2xl md:h-56"
    >
      {slides.map((title, index) => (
        <SwiperSlide key={title}>
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-r ${SLIDE_GRADIENTS[index % SLIDE_GRADIENTS.length]}`}
          >
            <span className="px-6 text-center text-2xl font-bold text-white drop-shadow md:text-3xl">
              {title}
            </span>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
