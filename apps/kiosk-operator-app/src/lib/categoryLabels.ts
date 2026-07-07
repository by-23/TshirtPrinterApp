import type { DesignCategory } from "@tshirt/shared-types";

export const CATEGORY_LABEL_KEYS: Record<DesignCategory, string> = {
  memes: "home.categories.memes",
  anime_movies: "home.categories.animeMovies",
  games: "home.categories.games",
  text: "home.categories.text",
  custom: "home.categories.custom",
  ai_style: "home.categories.aiStyle",
};

/** Categories that skip the gallery and open the editor directly from home. */
export const EDITOR_DIRECT_CATEGORIES = new Set<DesignCategory>(["text", "custom"]);

export function getCategoryRoute(category: DesignCategory): string {
  return EDITOR_DIRECT_CATEGORIES.has(category)
    ? `/kiosk/editor?category=${category}`
    : `/kiosk/category/${category}`;
}

export function getEditorBackRoute(category: DesignCategory | null | undefined): string {
  if (category && !EDITOR_DIRECT_CATEGORIES.has(category)) {
    return `/kiosk/category/${category}`;
  }
  return "/kiosk";
}
