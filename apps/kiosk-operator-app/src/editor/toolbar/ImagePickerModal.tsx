import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import type { Design, DesignCategory } from "@tshirt/shared-types";
import { appendDesignPage, fetchDesignsPage, fetchPopularDesigns, resolveDesignImageUrl } from "../../lib/pointServer.js";
import { getKioskOverlayRoot } from "../../lib/kioskOverlayPortal.js";
import { addImageFromUrl } from "../canvasImage.js";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";
import { CircleX, FilmIcon, GamepadIcon, PhotoIcon, SearchIcon, SpinnerIcon, StarIcon } from "../../components/icons.js";

const GALLERY_TABS = ["memes", "anime_movies", "games"] as const satisfies readonly DesignCategory[];
type GalleryTabCategory = (typeof GALLERY_TABS)[number];
type TabId = GalleryTabCategory | "popular";

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;
const POPULAR_LIMIT = 48;

const TAB_ICON: Record<TabId, (props: { className?: string }) => JSX.Element> = {
  popular: StarIcon,
  memes: PhotoIcon,
  anime_movies: FilmIcon,
  games: GamepadIcon,
};

export interface ImagePickerModalProps {
  canvas: Canvas | null;
  onClose: () => void;
}

function DesignTile({ design, onSelect }: { design: Design; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={design.title}
      className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-ink-800 p-2 transition-transform hover:scale-105 hover:bg-ink-700"
    >
      {design.imageUrl ? (
        <img
          src={resolveDesignImageUrl(design.imageUrl)}
          alt={design.title}
          className="h-full w-full object-contain"
        />
      ) : (
        <PhotoIcon className="h-10 w-10 text-ink-500" />
      )}
    </button>
  );
}

/** Popular tab — one flat, unpaginated fetch (mirrors the home "Популярные принты" banner); no search box. */
function PopularTab({ onSelect }: { onSelect: (url: string) => void }) {
  const { t } = useTranslation();
  const [designs, setDesigns] = useState<Design[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPopularDesigns(POPULAR_LIMIT)
      .then((items) => {
        if (!cancelled) setDesigns(items);
      })
      .catch(() => {
        if (!cancelled) setDesigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (designs === null) {
    return <div className="flex min-h-0 flex-1 items-center justify-center text-ink-300">{t("common.loading")}</div>;
  }
  if (designs.length === 0) {
    return <div className="flex min-h-0 flex-1 items-center justify-center text-ink-300">{t("gallery.empty")}</div>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-4 gap-3 p-1 sm:grid-cols-5">
        {designs.map((design) => (
          <DesignTile key={design.id} design={design} onSelect={() => onSelect(resolveDesignImageUrl(design.imageUrl))} />
        ))}
      </div>
    </div>
  );
}

/** One gallery category tab — condensed version of `CategoryGallery.tsx`'s infinite-scroll + search, rendered inside the modal instead of a full route. */
function CategoryTab({ category, onSelect }: { category: DesignCategory; onSelect: (url: string) => void }) {
  const { t } = useTranslation();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setDesigns([]);
    setTotal(0);
    fetchDesignsPage(category, { search: search || undefined, offset: 0, limit: PAGE_SIZE })
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setDesigns(page.items);
        setTotal(page.total);
      })
      .catch(() => {
        // Fail-open — leave the tab empty rather than blocking the whole modal.
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [category, search]);

  const hasMore = designs.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    fetchDesignsPage(category, { search: search || undefined, offset: designs.length, limit: PAGE_SIZE })
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setDesigns((prev) => appendDesignPage(prev, page.items));
        setTotal(page.total);
      })
      .catch(() => {})
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingMore(false);
      });
  }, [category, search, designs.length, loadingMore, hasMore]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-shrink-0 items-center gap-2 rounded-full bg-ink-800 px-4 py-2">
        <SearchIcon className="h-4 w-4 flex-shrink-0 text-ink-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("gallery.searchPlaceholder")}
          className="w-full bg-transparent text-sm text-white focus:outline-none"
        />
      </div>

      <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading && designs.length === 0 && (
          <div className="flex h-full items-center justify-center text-ink-300">{t("gallery.loading")}</div>
        )}
        {!loading && designs.length === 0 && (
          <div className="flex h-full items-center justify-center text-ink-300">
            {search ? t("gallery.noResults") : t("gallery.empty")}
          </div>
        )}
        {designs.length > 0 && (
          <div className="grid grid-cols-4 gap-3 p-1 sm:grid-cols-5">
            {designs.map((design) => (
              <DesignTile key={design.id} design={design} onSelect={() => onSelect(resolveDesignImageUrl(design.imageUrl))} />
            ))}
            {hasMore && (
              <div ref={sentinelRef} className="flex aspect-square items-center justify-center">
                <SpinnerIcon className="h-6 w-6 animate-spin text-ink-400" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * "Картинка" toolbar tool — full-screen modal (portalled to the kiosk overlay
 * root inside `KioskShell.tsx` so it stays within the 1080×1920 canvas even
 * when `KioskFrame` scales the device preview) with the same category tabs as
 * the kiosk's own gallery, plus a "Популярное" tab. Picking an image adds it
 * to the current design via `addImageFromUrl` without touching anything
 * already on the canvas.
 */
export function ImagePickerModal({ canvas, onClose }: ImagePickerModalProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("popular");

  function handleSelect(url: string) {
    if (!canvas) return;
    void addImageFromUrl(canvas, url);
    onClose();
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "popular", label: t("editor.toolbar.imagePicker.popular") },
    ...GALLERY_TABS.map((category) => ({ id: category as TabId, label: t(CATEGORY_LABEL_KEYS[category]) })),
  ];

  return createPortal(
    <div
      className="pointer-events-auto absolute inset-0 z-[900] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 w-full max-h-full max-w-3xl flex-col gap-4 rounded-3xl border border-ink-600 bg-ink-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-4">
          <h3 className="text-lg font-bold uppercase tracking-wide text-white">{t("editor.toolbar.imagePicker.title")}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.back")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink-800 text-white transition-colors hover:bg-ink-700"
          >
            <CircleX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {tabs.map(({ id, label }) => {
            const Icon = TAB_ICON[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  tab === id ? "bg-neon-pink text-white shadow-neon-pink" : "bg-ink-800 text-ink-200 hover:bg-ink-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {tab === "popular" ? (
          <PopularTab onSelect={handleSelect} />
        ) : (
          <CategoryTab key={tab} category={tab} onSelect={handleSelect} />
        )}
      </div>
    </div>,
    getKioskOverlayRoot(),
  );
}
