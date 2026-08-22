import { designCategorySchema, type DesignCategory } from "@tshirt/shared-types";

export const CATEGORY_LABEL_KEYS: Record<DesignCategory, string> = {
  misc: "home.categories.misc",
  anime_movies: "home.categories.animeMovies",
  games: "home.categories.games",
  text: "home.categories.text",
  custom: "home.categories.custom",
  ai_style: "home.categories.aiStyle",
};

/** Categories that skip the gallery and open the editor directly from home. */
export const EDITOR_DIRECT_CATEGORIES = new Set<DesignCategory>(["text", "custom"]);

export function getCategoryRoute(category: DesignCategory): string {
  // ИИ-раздел (Этап 9) — its own wizard (`/kiosk/ai`), not the plain gallery/stub route.
  if (category === "ai_style") {
    return "/kiosk/ai";
  }
  return EDITOR_DIRECT_CATEGORIES.has(category)
    ? `/kiosk/editor?category=${category}`
    : `/kiosk/category/${category}`;
}

export function getEditorBackRoute(category: DesignCategory | null | undefined): string {
  if (category === "ai_style") {
    return "/kiosk/ai";
  }
  if (category && !EDITOR_DIRECT_CATEGORIES.has(category)) {
    return `/kiosk/category/${category}`;
  }
  return "/kiosk";
}

/** Old kiosk URLs used `memes`; that gallery is now `misc` (Разное). */
export function parseDesignCategoryParam(value: string | null | undefined): DesignCategory | null {
  const parsed = designCategorySchema.safeParse(value === "memes" ? "misc" : value);
  return parsed.success ? parsed.data : null;
}
