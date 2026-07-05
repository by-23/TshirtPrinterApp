import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designCategorySchema, type DesignCategory } from "@tshirt/shared-types";
import { CATEGORY_LABEL_KEYS } from "../lib/categoryLabels.js";

const CATEGORY_ICONS: Record<DesignCategory, string> = {
  memes: "😼",
  anime_movies: "🎬",
  games: "🎮",
  text: "🔤",
  custom: "🎨",
  ai_style: "🤖",
};

/**
 * Card background gradient + neon hover glow per category, matching
 * `docs/ui-mockups/category-select.png`. Classes are written out in full
 * (not interpolated) so Tailwind's content scanner can detect them.
 */
const CATEGORY_STYLES: Record<DesignCategory, string> = {
  memes: "from-sky-700 to-blue-900 hover:shadow-neon-blue",
  anime_movies: "from-fuchsia-700 to-pink-900 hover:shadow-neon-pink",
  games: "from-violet-700 to-indigo-950 hover:shadow-neon-purple",
  text: "from-teal-700 to-teal-950 hover:shadow-neon-teal",
  custom: "from-emerald-700 to-emerald-950 hover:shadow-neon-teal",
  ai_style: "from-ink-800 to-ink-950 hover:shadow-neon-pink",
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
          to={
            EDITOR_CATEGORIES.has(category)
              ? `/kiosk/editor?category=${category}`
              : `/kiosk/category/${category}`
          }
          className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br p-6 text-center transition-transform hover:scale-[1.02] active:scale-100 ${CATEGORY_STYLES[category]}`}
        >
          <span className="text-4xl" aria-hidden>
            {CATEGORY_ICONS[category]}
          </span>
          <span className="text-lg font-bold uppercase tracking-wide text-white">
            {t(CATEGORY_LABEL_KEYS[category])}
          </span>
        </Link>
      ))}
    </div>
  );
}