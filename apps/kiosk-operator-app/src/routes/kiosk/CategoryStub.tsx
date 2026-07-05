import { Link, useParams } from "react-router-dom";
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

export function CategoryStub() {
  const { t } = useTranslation();
  const { category } = useParams<{ category: string }>();
  const parsed = designCategorySchema.safeParse(category);
  const title = parsed.success ? t(CATEGORY_LABEL_KEYS[parsed.data]) : category;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white">
      <h1 className="text-4xl font-bold">{title} (заглушка)</h1>
      <p className="text-gray-500">Раздел будет реализован в следующих этапах.</p>
      <Link
        to="/kiosk"
        className="rounded-full bg-black px-6 py-3 text-white transition-colors hover:bg-gray-800"
      >
        {t("common.back")}
      </Link>
    </div>
  );
}
