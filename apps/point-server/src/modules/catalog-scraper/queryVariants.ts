import type { GalleryCategory } from "@tshirt/shared-types";

/**
 * Default search query tags per category, tried in order once the previous
 * one runs out of new unique pins (docs/PLAN.md Этап 3, "Исчерпание
 * результатов поиска"). Only used to seed `catalog_scrape_query_tags` on
 * first read — after that, `queryTags.ts` is the source of truth and the
 * lists are editable from the "Дизайны" tab.
 */
export const DEFAULT_QUERY_VARIANTS: Record<GalleryCategory, string[]> = {
  misc: [
    "стикер png",
    "наклейка png",
    "clipart png",
    "sticker png",
    "иллюстрация png",
    "illustration png",
  ],
  anime_movies: [
    "аниме png",
    "аниме персонажи png",
    "anime png",
    "аниме арт png",
    "постер фильма png",
    "movie poster png",
  ],
  games: [
    "игры png",
    "игровой персонаж png",
    "games png",
    "видеоигра арт png",
    "пиксель арт png",
    "game character png",
  ],
};

/** Picks the query tag at `index`, wrapping around once the list of `tags` is exhausted. */
export function variantAt(tags: string[], index: number): string {
  return tags[index % tags.length]!;
}
