import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { designCategorySchema, type Design, type DesignCategory } from "@tshirt/shared-types";
import { appendDesignPage, fetchDesignsPage, resolveDesignImageUrl } from "../../lib/pointServer.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";
import { ArrowLeft, FilmIcon, GamepadIcon, Heart, PhotoIcon, SearchIcon, SpinnerIcon } from "../../components/icons.js";

type LoadState = "loading" | "ready" | "error";

// Page size + prefetch buffer both 12 (docs/PLAN.md Этап 3, "Наполнение и
// подгрузка") — the point-server side keeps at least this many images ahead
// of whatever's been served so far, per category. 12 also matches the default
// 3x4 grid below, so a "page" of results always fills the screen exactly.
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 400;
// Auto-reconnect for the initial page load: point-server might just be mid
// boot/restart (e.g. right after the kiosk PC powers on), so a single failed
// fetch shouldn't dead-end the user on an error screen. Keep retrying with
// backoff forever in the background; only surface the error text after a
// few attempts, and drop it the instant point-server answers again — no
// manual "Назад"/retry needed (docs/PLAN.md fail-open principle).
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 8000;
const ERROR_VISIBLE_AFTER_ATTEMPTS = 3;
// While the background scraper is still topping up a category, the sentinel
// never leaves the viewport (user parked at the bottom) so it won't refire
// its own IntersectionObserver callback — poll on this interval instead so
// freshly scraped designs still show up without the user scrolling away and back.
const SCRAPE_POLL_MS = 2500;
// How many `--gallery-card-accent-N` tokens are declared in index.css —
// GalleryThemePanel.tsx exposes exactly this many color swatches.
const ACCENT_COUNT = 7;

const CATEGORY_ICON: Partial<Record<DesignCategory, (props: { className?: string }) => JSX.Element>> = {
  memes: PhotoIcon,
  anime_movies: FilmIcon,
  games: GamepadIcon,
};

function DesignCard({ design, index, onSelect }: { design: Design; index: number; onSelect: () => void }) {
  const Icon = CATEGORY_ICON[design.category] ?? PhotoIcon;
  const accentVar = `var(--gallery-card-accent-${(index % ACCENT_COUNT) + 1})`;

  return (
    <div className="gallery-card-shell relative">
      <button
        type="button"
        onClick={onSelect}
        aria-label={design.title}
        style={{ "--gallery-card-accent": accentVar } as CSSProperties}
        className="gallery-card flex aspect-square items-center justify-center overflow-hidden transition-transform active:scale-[0.96] hover:-translate-y-1"
      >
        {design.imageUrl ? (
          <img
            src={resolveDesignImageUrl(design.imageUrl)}
            alt={design.title}
            className="h-full w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <Icon className="h-16 w-16" style={{ color: "var(--gallery-card-icon-color)" }} />
        )}
      </button>
      {design.useCount > 0 && (
        <span className="gallery-card-hearts pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded-pill bg-ink-950/80 px-2 py-1 text-[12px] font-bold text-white backdrop-blur">
          <Heart aria-hidden className="h-3 w-3" fill="var(--brand-primary)" stroke="var(--brand-primary)" strokeWidth={0} />
          {design.useCount}
        </span>
      )}
    </div>
  );
}

function LoadingMoreCard() {
  return (
    <div className="gallery-card-shell">
      <div
        className="gallery-card gallery-card--loading flex aspect-square flex-col items-center justify-center gap-3"
        style={{ color: "var(--gallery-card-loading-icon-color)" }}
      >
        <SpinnerIcon className="h-8 w-8 animate-spin" />
      </div>
    </div>
  );
}

export function CategoryGallery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const parsedCategory = designCategorySchema.safeParse(category);
  const [state, setState] = useState<LoadState>("loading");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [total, setTotal] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const requestIdRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether the sentinel is currently on-screen, kept up to date by
  // the IntersectionObserver below — read by the scrape-poll timer so it
  // doesn't keep firing requests once the user scrolls back up.
  const isSentinelVisibleRef = useRef(false);
  const categorySuccess = parsedCategory.success;
  const categoryValue = parsedCategory.success ? parsedCategory.data : null;

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Initial load + reload from scratch whenever the category or the
  // (debounced) search term changes. Auto-retries with backoff on failure
  // instead of dead-ending on the error screen — see `RETRY_BASE_MS` above.
  useEffect(() => {
    if (!categorySuccess || categoryValue === null) return;

    const requestId = ++requestIdRef.current;
    let retryTimer: number | null = null;
    let attempt = 0;
    setState("loading");
    setDesigns([]);
    setTotal(0);
    setScraping(false);

    const attemptLoad = () => {
      fetchDesignsPage(categoryValue, { search: search || undefined, offset: 0, limit: PAGE_SIZE })
        .then((page) => {
          if (requestIdRef.current !== requestId) return;
          setDesigns(page.items);
          setTotal(page.total);
          setScraping(page.scraping);
          setState("ready");
        })
        .catch(() => {
          if (requestIdRef.current !== requestId) return;
          attempt += 1;
          // Stay on the loading spinner for the first couple of attempts —
          // point-server is very likely just restarting/booting — and only
          // show the error copy once it's been failing for a while. Either
          // way, keep retrying forever in the background.
          setState(attempt >= ERROR_VISIBLE_AFTER_ATTEMPTS ? "error" : "loading");
          const delay = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
          retryTimer = window.setTimeout(attemptLoad, delay);
        });
    };

    attemptLoad();

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [categorySuccess, categoryValue, search]);

  // Keep showing the spinner card while the background scraper is still
  // topping up this category, even once `designs` has caught up with
  // `total` — otherwise the list would cut off abruptly mid-download
  // (docs/PLAN.md Этап 3, "карточка-спиннер вместо резкого обрыва списка").
  const hasMore = designs.length < total || scraping;

  const loadMore = useCallback(() => {
    if (!categorySuccess || categoryValue === null || loadingMore || !hasMore) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    fetchDesignsPage(categoryValue, { search: search || undefined, offset: designs.length, limit: PAGE_SIZE })
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setDesigns((prev) => appendDesignPage(prev, page.items));
        setTotal(page.total);
        setScraping(page.scraping);
      })
      .catch(() => {
        // Fail-open: keep whatever's already on screen, just stop trying for now.
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingMore(false);
      });
  }, [categorySuccess, categoryValue, search, designs.length, loadingMore, hasMore]);

  // `loadMore` gets a new identity after every fetch (its deps include
  // `designs.length`/`loadingMore`), but the observer/poll effects below
  // must NOT reconnect every time that happens: re-`observe()`-ing an
  // element that's already on-screen makes the browser re-fire the
  // intersection callback immediately, which — combined with a `loadMore`
  // that resolves to "nothing new yet" while the scraper is slow — used to
  // spin into a tight fetch loop (hammering point-server, looking like the
  // page "hung" and then reset). Reading the latest `loadMore` through a
  // ref lets the observer/timer stay alive across those identity changes.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Fires `loadMore` once the spinner sentinel scrolls into view. Only
  // reconnects when `hasMore` actually flips (i.e. the sentinel mounts or
  // unmounts) — see note on `loadMoreRef` above.
  useEffect(() => {
    const node = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!node || !root || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        isSentinelVisibleRef.current = intersecting;
        if (intersecting) loadMoreRef.current();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => {
      isSentinelVisibleRef.current = false;
      observer.disconnect();
    };
  }, [hasMore]);

  // The sentinel only re-triggers the observer above when it crosses the
  // viewport edge, so a user parked at the bottom while the scraper is still
  // running would otherwise see the spinner spin forever. Poll instead —
  // depends only on `scraping`/`hasMore` so the interval actually gets to
  // run its full course instead of being reset on every fetch (same
  // reasoning as `loadMoreRef` above).
  useEffect(() => {
    if (!scraping || !hasMore) return;
    const timer = setInterval(() => {
      if (isSentinelVisibleRef.current) loadMoreRef.current();
    }, SCRAPE_POLL_MS);
    return () => clearInterval(timer);
  }, [scraping, hasMore]);

  if (!parsedCategory.success) {
    return (
      <div
        className="gallery-theme-root flex h-full w-full flex-col items-center justify-center gap-4 text-white"
        style={{ backgroundColor: "var(--gallery-page-bg)" }}
      >
        <Link
          to="/kiosk"
          className="rounded-pill bg-neon-pink px-6 py-3 font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
        >
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const title = t(CATEGORY_LABEL_KEYS[parsedCategory.data]);

  return (
    <div
      ref={scrollRootRef}
      className="gallery-theme-root flex h-full w-full flex-col overflow-y-auto overflow-x-hidden text-white"
      style={{
        backgroundColor: "var(--gallery-page-bg)",
        paddingInline: "var(--gallery-page-padding-x)",
        paddingBlock: "var(--gallery-page-padding-y)",
        gap: "var(--gallery-page-section-gap)",
      }}
    >
      <header className="relative z-10 flex flex-shrink-0 items-center justify-between gap-4">
        <Link
          to="/kiosk"
          aria-label={t("common.back")}
          className="flex flex-shrink-0 items-center gap-2 px-5 font-bold uppercase tracking-wide text-white transition-colors hover:border-neon-pink hover:text-neon-pink"
          style={{
            height: "var(--gallery-back-btn-height)",
            borderRadius: "var(--gallery-back-btn-radius)",
            backgroundColor: "var(--gallery-back-btn-bg)",
            borderStyle: "solid",
            borderWidth: "var(--gallery-back-btn-border-width)",
            borderColor: "var(--gallery-back-btn-border-color)",
            fontSize: "var(--gallery-back-btn-font-size)",
          }}
        >
          <ArrowLeft aria-hidden className="h-5 w-5 flex-shrink-0" strokeWidth={2.6} />
          <span>{t("common.back")}</span>
        </Link>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <h1
            className="font-black uppercase tracking-wide"
            style={{ fontSize: "var(--gallery-header-title-size)", color: "var(--gallery-header-title-color)" }}
          >
            {title}
          </h1>
        </div>
        <LanguageSwitcherSlot />
      </header>

      <div className="gallery-search relative z-10 flex flex-shrink-0 items-center gap-3 px-6">
        <SearchIcon
          aria-hidden
          className="pointer-events-none flex-shrink-0"
          style={{ width: "var(--gallery-search-icon-size)", height: "var(--gallery-search-icon-size)", color: "var(--gallery-search-icon-color)" }}
        />
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("gallery.searchPlaceholder")}
          className="w-full bg-transparent focus:outline-none"
          style={{ fontSize: "var(--gallery-search-font-size)", color: "var(--gallery-search-text-color)" }}
        />
      </div>

      {state === "loading" && (
        <div className="flex flex-1 items-center justify-center text-ink-200">{t("gallery.loading")}</div>
      )}

      {state === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-200">
          <p>{t("gallery.error")}</p>
          <Link
            to="/kiosk"
            className="rounded-pill bg-neon-pink px-6 py-3 font-semibold text-white shadow-neon-pink transition-transform hover:scale-105"
          >
            {t("common.back")}
          </Link>
        </div>
      )}

      {state === "ready" && designs.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-center text-ink-200">
          {search ? t("gallery.noResults") : t("gallery.empty")}
        </div>
      )}

      {state === "ready" && designs.length > 0 && (
        <div className="gallery-grid">
          {designs.map((design, index) => (
            <DesignCard
              key={design.id}
              design={design}
              index={index}
              onSelect={() =>
                navigate(`/kiosk/editor?category=${parsedCategory.data}&designId=${design.id}`)
              }
            />
          ))}
          {hasMore && (
            <div ref={sentinelRef}>
              <LoadingMoreCard />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
