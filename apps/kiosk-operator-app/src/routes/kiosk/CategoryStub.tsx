import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designCategorySchema } from "@tshirt/shared-types";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";

export function CategoryStub() {
  const { t } = useTranslation();
  const { category } = useParams<{ category: string }>();
  const parsed = designCategorySchema.safeParse(category);
  const title = parsed.success ? t(CATEGORY_LABEL_KEYS[parsed.data]) : category;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950 text-white">
      <h1 className="text-4xl font-bold">{title} (заглушка)</h1>
      <p className="text-ink-200">Раздел будет реализован в следующих этапах.</p>
      <Link
        to="/kiosk"
        className="rounded-full bg-neon-pink px-6 py-3 font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
      >
        {t("common.back")}
      </Link>
    </div>
  );
}
