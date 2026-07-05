import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designCategorySchema, type Design, type DesignCategory } from "@tshirt/shared-types";
import { fetchDesigns } from "../../lib/pointServer.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";
import { FilmIcon, GamepadIcon, PhotoIcon } from "../../components/icons.js";

type LoadState = "loading" | "ready" | "error";

const CATEGORY_ICON: Partial<Record<DesignCategory, (props: { className?: string }) => JSX.Element>> = {
  memes: PhotoIcon,
  anime_movies: FilmIcon,
  games: GamepadIcon,
};

function DesignCard({ design, onSelect }: { design: Design; onSelect: () => void }) {
  const Icon = CATEGORY_ICON[design.category] ?? PhotoIcon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex h-56 flex-col items-center justify-center gap-4 overflow-hidden rounded-[var(--radius-card-sm)] border-2 border-ink-600 bg-ink-800 p-4 transition-transform active:scale-[0.97] hover:border-neon-pink"
    >
      {design.imageUrl ? (
        <img src={design.imageUrl} alt={design.title} className="h-28 w-28 object-contain" />
      ) : (
        <Icon className="h-16 w-16 text-ink-200" />
      )}
      <span className="text-center text-sm font-semibold uppercase tracking-wide text-white">
        {design.title}
      </span>
    </button>
  );
}

export function CategoryGallery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const parsedCategory = designCategorySchema.safeParse(category);
  const [state, setState] = useState<LoadState>("loading");
  const [designs, setDesigns] = useState<Design[]>([]);

  useEffect(() => {
    if (!parsedCategory.success) return;

    let cancelled = false;
    setState("loading");

    fetchDesigns(parsedCategory.data)
      .then((data) => {
        if (cancelled) return;
        setDesigns(data);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [parsedCategory.success, parsedCategory.success ? parsedCategory.data : null]);

  if (!parsedCategory.success) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ink-950 text-white">
        <Link
          to="/kiosk"
          className="rounded-full bg-neon-pink px-6 py-3 font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
        >
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const title = t(CATEGORY_LABEL_KEYS[parsedCategory.data]);

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-hidden bg-ink-950 p-4 text-white">
      <header className="flex items-center justify-between gap-4">
        <Link
          to="/kiosk"
          aria-label={t("common.back")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-800 text-lg text-white transition-colors hover:bg-ink-700"
        >
          ←
        </Link>
        <h1 className="text-center text-lg font-bold uppercase tracking-wide sm:text-xl">{title}</h1>
        <LanguageSwitcherSlot />
      </header>

      {state === "loading" && (
        <div className="flex flex-1 items-center justify-center text-ink-200">{t("gallery.loading")}</div>
      )}

      {state === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-200">
          <p>{t("gallery.error")}</p>
          <Link
            to="/kiosk"
            className="rounded-full bg-neon-pink px-6 py-3 font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
          >
            {t("common.back")}
          </Link>
        </div>
      )}

      {state === "ready" && designs.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-center text-ink-200">
          {t("gallery.empty")}
        </div>
      )}

      {state === "ready" && designs.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {designs.map((design) => (
            <DesignCard
              key={design.id}
              design={design}
              onSelect={() =>
                navigate(`/kiosk/editor?category=${parsedCategory.data}&designId=${design.id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
