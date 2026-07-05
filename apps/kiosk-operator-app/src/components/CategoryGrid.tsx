import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designCategorySchema, type DesignCategory } from "@tshirt/shared-types";

const CATEGORY_LABEL_KEYS: Record<DesignCategory, string> = {
  memes: "home.categories.memes",
  anime_movies: "home.categories.animeMovies",
  games: "home.categories.games",
  text: "home.categories.text",
  custom: "home.categories.custom",
  ai_style: "home.categories.aiStyle",
};

const CATEGORY_ICONS: Record<DesignCategory, string> = {
  memes: "😂",
  anime_movies: "🎬",
  games: "🎮",
  text: "🔤",
  custom: "🎨",
  ai_style: "✨",
};

// "text" and "custom" open straight into the editor with a blank garment
// (per ТЗ: "чистая одежда + полный редактор"). The other categories still
// point to the gallery stub until Stage 3 (catalog) and Stage 9 (AI) land.
const EDITOR_CATEGORIES = new Set<DesignCategory>(["text", "custom"]);

export function CategoryGrid() {
  const { t } = useTranslation();
  const categories = designCategorySchema.options;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {categories.map((category) => (
        <Link
          key={category}
          to={EDITOR_CATEGORIES.has(category) ? "/kiosk/editor" : `/kiosk/category/${category}`}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gray-100 p-6 text-center transition-colors hover:bg-gray-200 active:bg-gray-300"
        >
          <span className="text-4xl">{CATEGORY_ICONS[category]}</span>
          <span className="text-lg font-semibold text-gray-800">
            {t(CATEGORY_LABEL_KEYS[category])}
          </span>
        </Link>
      ))}
    </div>
  );
}
