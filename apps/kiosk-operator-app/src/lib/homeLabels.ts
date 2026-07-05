import type { DesignCategory } from "@tshirt/shared-types";

/**
 * The category cards on the home screen always show every caption in
 * RU + KK/EN/ZH simultaneously (RU bold on top, the other three small
 * underneath), independent of the language pill the visitor has selected —
 * this is a discoverability aid so any customer can recognize their
 * language before switching. These strings are intentionally static (not
 * routed through i18next) to match that fixed multi-language layout.
 */
export const HOME_STATIC_LABELS = {
  bannerTitle: "ПОПУЛЯРНЫЕ ПРИНТЫ",
  categorySelect: {
    main: "ВЫБЕРИТЕ КАТЕГОРИЮ",
    sub: "КАТЕГОРИЯНЫ ТАҢДАҢЫЗ / CHOOSE A CATEGORY / 选择类别",
  },
};

export const CATEGORY_HOME_LABELS: Record<DesignCategory, { main: string; sub: string }> = {
  memes: { main: "МЕМЫ", sub: "МЕМДЕР / MEMES / 表情包" },
  anime_movies: { main: "АНИМЕ", sub: "АНИМЕ / ANIME / 动漫" },
  games: { main: "ИГРЫ", sub: "ОЙЫНДАР / GAMES / 游戏" },
  text: { main: "НАДПИСЬ", sub: "ЖАЗУ / TEXT / 文字" },
  custom: { main: "СВОЙ ДИЗАЙН", sub: "ӨЗ ДИЗАЙНЫҢ / YOUR DESIGN / 自定义设计" },
  ai_style: { main: "ИИ СТИЛИ", sub: "AI СТИЛДЕРІ / AI STYLES / AI 风格" },
};
