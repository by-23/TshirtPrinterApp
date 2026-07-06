import { useEffect, useState } from "react";
import type { Design } from "@tshirt/shared-types";
import { fetchDesigns } from "../../lib/pointServer.js";
import { PhotoIcon } from "../../components/icons.js";

const CATEGORY_LABELS: Record<string, string> = {
  memes: "Мемы",
  anime_movies: "Аниме и фильмы",
  games: "Игры",
  text: "Надписи",
  custom: "Свой дизайн",
  ai_style: "ИИ-стиль",
};

/**
 * Read-only catalog viewer for the sidebar's "Дизайны" item (full CRUD lives
 * in the admin panel, Stage 6). Sizes/spacing are `--operator-designs-*` CSS
 * tokens, live tunable via `OperatorThemePanel`.
 */
export function DesignsPanel() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDesigns()
      .then((rows) => {
        if (!cancelled) {
          setDesigns(rows);
          setLoaded(true);
        }
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{ padding: "var(--operator-designs-padding-y) var(--operator-designs-padding-x)" }}
    >
      <h2 className="mb-4 font-extrabold text-white" style={{ fontSize: "var(--operator-designs-title-size)" }}>
        Каталог дизайнов
      </h2>
      {!loaded && (
        <p style={{ color: "var(--operator-text-muted)" }} className="text-base">
          Загрузка…
        </p>
      )}
      {loaded && designs.length === 0 && (
        <p style={{ color: "var(--operator-text-muted)" }} className="text-base">
          Каталог пуст
        </p>
      )}

      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(var(--operator-designs-columns), minmax(0, 1fr))",
          gap: "var(--operator-designs-gap)",
        }}
      >
        {designs.map((design) => (
          <div
            key={design.id}
            className="flex flex-col overflow-hidden"
            style={{
              borderRadius: "var(--operator-designs-card-radius)",
              backgroundColor: "var(--operator-card-bg)",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            <div className="flex aspect-square items-center justify-center" style={{ backgroundColor: "var(--operator-page-bg)" }}>
              {design.imageUrl ? (
                <img src={design.imageUrl} alt={design.title} className="h-full w-full object-cover" />
              ) : (
                <PhotoIcon
                  style={{ width: "var(--operator-designs-icon-size)", height: "var(--operator-designs-icon-size)", color: "var(--operator-text-muted)" }}
                />
              )}
            </div>
            <div className="flex flex-col gap-1" style={{ padding: "var(--operator-designs-card-padding)" }}>
              <span className="truncate font-semibold text-white" style={{ fontSize: "var(--operator-designs-card-title-size)" }}>
                {design.title}
              </span>
              <span style={{ fontSize: "var(--operator-designs-card-category-size)", color: "var(--operator-text-muted)" }}>
                {CATEGORY_LABELS[design.category] ?? design.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
