import { useCallback, useEffect, useState } from "react";
import type {
  CatalogCacheUsage,
  CatalogScrapeConfig,
  CatalogScrapeStatus,
  CategoryCacheUsage,
  CategoryQueryTags,
  Design,
  DesignCategory,
  GalleryCategory,
} from "@tshirt/shared-types";
import {
  deleteDesign,
  deleteDesignsByCategory,
  fetchCacheUsage,
  fetchDesignsPage,
  fetchQueryTags,
  fetchScrapeConfig,
  fetchScrapeStatus,
  appendDesignPage,
  setDesignIsolated,
  triggerScrapeRun,
  updateQueryTags,
  updateScrapeConfig,
  testGiphyApiKey,
  resolveDesignImageUrl,
} from "../../lib/pointServer.js";
import {
  HardDrive,
  Heart,
  LayoutGrid,
  Lock,
  LockOpen,
  PhotoIcon,
  SearchIcon,
  SlidersHorizontal,
  SpinnerIcon,
  Tag,
  Trash2,
} from "../../components/icons.js";

const CATEGORY_LABELS: Record<string, string> = {
  memes: "Мемы",
  anime_movies: "Аниме",
  games: "Игры",
  text: "Надписи",
  custom: "Свой дизайн",
  ai_style: "ИИ-стиль",
};

/** All 6 catalog categories, in the same order shown on the kiosk's home grid — used by the "Галерея" tab's filter. */
const ALL_CATEGORIES: DesignCategory[] = ["memes", "anime_movies", "games", "text", "custom", "ai_style"];

const STATUS_LABELS: Record<CatalogScrapeStatus["status"], string> = {
  idle: "Ожидание",
  running: "Идёт докачка…",
  success: "Готово",
  error: "Ошибка",
};

const STATUS_COLORS: Record<CatalogScrapeStatus["status"], string> = {
  idle: "var(--operator-text-muted)",
  running: "#f5b301",
  success: "#3ecf5f",
  error: "#f14668",
};

function formatRunDate(value: string | null): string {
  if (!value) return "ещё не запускалась";
  return new Date(value).toLocaleString("ru-RU");
}

/** e.g. `1.2 ГБ`, `340 МБ` — used by the cache usage overview. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 МБ";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} ГБ`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} МБ`;
}

const FIELD_LABEL_CLASS = "flex flex-col gap-1 text-sm";
const FIELD_INPUT_CLASS = "rounded-lg px-3 py-2 text-white outline-none";
const CARD_CLASS = "flex flex-col gap-4 rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const INPUT_STYLE = { backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

type GiphyTestState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "success"; stickerCount: number }
  | { status: "error"; message: string };

function resolveGiphyKeyForTest(config: CatalogScrapeConfig, draft: string, editing: boolean): string {
  if (editing) return draft.trim();
  if (config.giphyApiKey?.trim()) return config.giphyApiKey.trim();
  if (config.giphyKeyConfigured) return "";
  return "";
}

/**
 * Big progress bar + GB limit / pace controls for the background cache
 * filler (docs/PLAN.md "кэш картинок по ГБ") — the "Обзор" tab. Polls
 * `/catalog/cache-usage` every few seconds so the bar/status keep moving
 * while the filler works in the background, without a page reload.
 */
function CacheOverviewPanel() {
  const [config, setConfig] = useState<CatalogScrapeConfig | null>(null);
  const [usage, setUsage] = useState<CatalogCacheUsage | null>(null);
  const [limitDraft, setLimitDraft] = useState("");
  const [batchDraft, setBatchDraft] = useState("");
  const [intervalDraft, setIntervalDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [togglingFill, setTogglingFill] = useState(false);

  const syncDraftsFromConfig = useCallback((data: CatalogScrapeConfig) => {
    setLimitDraft((data.cacheLimitMb / 1024).toFixed(1));
    setBatchDraft(String(data.cacheFillBatchSize));
    setIntervalDraft(String(data.cacheFillIntervalSec));
  }, []);

  useEffect(() => {
    fetchScrapeConfig()
      .then((data) => {
        setConfig(data);
        syncDraftsFromConfig(data);
      })
      .catch(() => undefined);
  }, [syncDraftsFromConfig]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchCacheUsage()
        .then((data) => !cancelled && setUsage(data))
        .catch(() => undefined);
    }
    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleToggleFill(enabled: boolean) {
    setTogglingFill(true);
    try {
      const updated = await updateScrapeConfig({ cacheFillEnabled: enabled });
      setConfig(updated);
    } catch {
      // fail-open: checkbox will just snap back on next config refresh
    } finally {
      setTogglingFill(false);
    }
  }

  async function handleSavePace() {
    const limitGb = Number(limitDraft.replace(",", "."));
    const batch = Number(batchDraft);
    const intervalSec = Number(intervalDraft);
    if (!Number.isFinite(limitGb) || limitGb <= 0) return;
    if (!Number.isInteger(batch) || batch <= 0) return;
    if (!Number.isInteger(intervalSec) || intervalSec <= 0) return;

    setSaving(true);
    setSavedNote(null);
    try {
      const updated = await updateScrapeConfig({
        cacheLimitMb: Math.max(1, Math.round(limitGb * 1024)),
        cacheFillBatchSize: batch,
        cacheFillIntervalSec: intervalSec,
      });
      setConfig(updated);
      syncDraftsFromConfig(updated);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  if (!config) return null;

  const totalBytes = usage?.totalBytes ?? 0;
  const limitBytes = usage?.limitBytes ?? config.cacheLimitMb * 1024 * 1024;
  const percent = limitBytes > 0 ? Math.min(100, (totalBytes / limitBytes) * 100) : 0;
  const isFull = limitBytes > 0 && totalBytes >= limitBytes;
  const fairShareBytes = limitBytes / Math.max(1, usage?.categories.length ?? 3);

  let statusLabel = "Ожидание следующей порции";
  let statusColor = "var(--operator-text-muted)";
  if (!config.cacheFillEnabled) {
    statusLabel = "На паузе — включите, чтобы кэш продолжил заполняться";
    statusColor = "#f5b301";
  } else if (isFull) {
    statusLabel = "Кэш заполнен до лимита";
    statusColor = "#3ecf5f";
  } else if (usage?.filling) {
    statusLabel = "Идёт спокойное пополнение кэша…";
    statusColor = "#f5b301";
  }

  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-white">Кэш картинок</span>
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={config.cacheFillEnabled}
            disabled={togglingFill}
            onChange={(event) => void handleToggleFill(event.target.checked)}
          />
          Фоновое пополнение
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-white">
            {formatBytes(totalBytes)} <span style={LABEL_STYLE}>из {formatBytes(limitBytes)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: statusColor }}>
            {usage?.filling && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {statusLabel}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--operator-page-bg)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, backgroundColor: isFull ? "#3ecf5f" : "var(--brand-primary, #ec4899)" }}
          />
        </div>
      </div>

      {usage && usage.categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={LABEL_STYLE}>
            По категориям (растут равномерно)
          </span>
          {usage.categories.map((item: CategoryCacheUsage) => {
            const share = fairShareBytes > 0 ? Math.min(100, (item.bytes / fairShareBytes) * 100) : 0;
            return (
              <div key={item.category} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                  <span style={LABEL_STYLE}>
                    {item.count} шт · {formatBytes(item.bytes)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--operator-page-bg)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share}%`, backgroundColor: "var(--brand-primary, #ec4899)", opacity: 0.75 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--operator-page-bg)" }}>
        <span className="text-sm font-semibold text-white">Лимит и скорость наполнения</span>
        <span className="text-xs" style={LABEL_STYLE}>
          Пока в кэше меньше картинок, чем разрешает лимит, точка сама, не торопясь, докачивает небольшими
          порциями — поровну на все категории — пока не заполнит его целиком.
        </span>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
            Лимит кэша (ГБ)
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={limitDraft}
              onChange={(event) => setLimitDraft(event.target.value)}
              className={FIELD_INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </label>
          <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
            Картинок за подход
            <input
              type="number"
              min={1}
              value={batchDraft}
              onChange={(event) => setBatchDraft(event.target.value)}
              className={FIELD_INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </label>
          <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
            Пауза между подходами (сек)
            <input
              type="number"
              min={1}
              value={intervalDraft}
              onChange={(event) => setIntervalDraft(event.target.value)}
              className={FIELD_INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSavePace()}
            disabled={saving}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          {savedNote && (
            <span className="text-sm" style={LABEL_STYLE}>
              {savedNote}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Operator-tunable knobs for the catalog scraper — Pinterest plus the
 * parallel Giphy/CleanPNG sources (Этап 3, "Несколько источников"). Lives on
 * point-server, not central-relay/admin-panel — see docs/PLAN.md for why.
 */
function ScrapeConfigForm() {
  const [config, setConfig] = useState<CatalogScrapeConfig | null>(null);
  const [giphyKeyDraft, setGiphyKeyDraft] = useState("");
  const [giphyKeyEditing, setGiphyKeyEditing] = useState(false);
  const [giphyKeySaving, setGiphyKeySaving] = useState(false);
  const [giphyKeyNote, setGiphyKeyNote] = useState<string | null>(null);
  const [giphyTest, setGiphyTest] = useState<GiphyTestState>({ status: "idle" });
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    fetchScrapeConfig()
      .then((data) => {
        setConfig(data);
        setGiphyKeyDraft(data.giphyApiKey ?? "");
      })
      .catch(() => undefined);
  }, []);

  if (!config) return null;

  function patch(partial: Partial<CatalogScrapeConfig>) {
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function handleSaveGiphyKey() {
    setGiphyKeySaving(true);
    setGiphyKeyNote(null);
    setGiphyTest({ status: "idle" });
    try {
      const updated = await updateScrapeConfig({
        giphyApiKey: giphyKeyDraft.trim() || null,
      });
      setConfig(updated);
      setGiphyKeyDraft(updated.giphyApiKey ?? "");
      setGiphyKeyEditing(false);
      setGiphyKeyNote("Сохранено");
    } catch {
      setGiphyKeyNote("Не удалось сохранить");
    } finally {
      setGiphyKeySaving(false);
      setTimeout(() => setGiphyKeyNote(null), 3000);
    }
  }

  function handleCancelGiphyKey() {
    setGiphyKeyDraft(config?.giphyApiKey ?? "");
    setGiphyKeyEditing(false);
    setGiphyKeyNote(null);
    setGiphyTest({ status: "idle" });
  }

  async function handleTestGiphyKey() {
    setGiphyTest({ status: "checking" });
    setGiphyKeyNote(null);
    try {
      const draftKey = giphyKeyEditing ? giphyKeyDraft : undefined;
      const result = await testGiphyApiKey(draftKey);
      if (result.ok) {
        setGiphyTest({ status: "success", stickerCount: result.stickerCount ?? 0 });
      } else {
        setGiphyTest({ status: "error", message: result.error ?? "Giphy отклонил ключ" });
      }
    } catch (error) {
      setGiphyTest({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось выполнить проверку",
      });
    }
  }

  function beginGiphyKeyEdit() {
    setGiphyKeyEditing(true);
    setGiphyTest({ status: "idle" });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setSavedNote(null);
    try {
      const updated = await updateScrapeConfig({
        minResolutionEnabled: config.minResolutionEnabled,
        minResolutionPx: config.minResolutionPx,
        pageSize: config.pageSize,
        bufferSize: config.bufferSize,
        requestDelayMs: config.requestDelayMs,
        maxRequestsPerHour: config.maxRequestsPerHour,
        giphyEnabled: config.giphyEnabled,
        cleanpngEnabled: config.cleanpngEnabled,
      });
      setConfig(updated);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  const primaryBtnClass =
    "rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50";
  const secondaryBtnClass =
    "rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50";
  const secondaryBtnStyle = {
    backgroundColor: "var(--operator-page-bg)",
    border: "1px solid var(--operator-card-border)",
  };

  const giphyKeyDisplay =
    config.giphyApiKey != null && config.giphyApiKey.length > 0
      ? "•".repeat(Math.min(config.giphyApiKey.length, 24))
      : config.giphyKeyConfigured
        ? "Задан в .env (скрыт)"
        : "Не задан";

  const giphyKeyForTest = resolveGiphyKeyForTest(config, giphyKeyDraft, giphyKeyEditing);
  const canTestGiphyKey = giphyKeyEditing ? giphyKeyDraft.trim().length > 0 : config.giphyKeyConfigured;

  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      <span className="font-bold text-white">Источники и параметры скачивания</span>

      <div className="flex flex-col gap-2 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--operator-page-bg)" }}>
        <span className="text-sm font-semibold text-white">Источники картинок</span>
        <span className="text-xs" style={LABEL_STYLE}>
          Все включённые источники докачивают картинки параллельно — так галерея наполняется быстрее, чем
          от одного Pinterest.
        </span>

        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked disabled />
          Pinterest (основной источник, отключить нельзя)
        </label>

        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={config.giphyEnabled}
            onChange={(event) => patch({ giphyEnabled: event.target.checked })}
          />
          Giphy Stickers
        </label>
        <label className={`${FIELD_LABEL_CLASS} pl-6`} style={LABEL_STYLE}>
          API-ключ Giphy
          {giphyKeyEditing ? (
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              className={FIELD_INPUT_CLASS}
              style={INPUT_STYLE}
              placeholder="Ключ с developers.giphy.com"
              value={giphyKeyDraft}
              onChange={(event) => setGiphyKeyDraft(event.target.value)}
            />
          ) : (
            <div
              className={`${FIELD_INPUT_CLASS} text-white`}
              style={{ ...INPUT_STYLE, cursor: "default", userSelect: "none" }}
            >
              {giphyKeyDisplay}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {!giphyKeyEditing ? (
              <button
                type="button"
                onClick={beginGiphyKeyEdit}
                className={secondaryBtnClass}
                style={secondaryBtnStyle}
              >
                Изменить
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleSaveGiphyKey()}
                  disabled={giphyKeySaving}
                  className={primaryBtnClass}
                  style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
                >
                  {giphyKeySaving ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelGiphyKey}
                  disabled={giphyKeySaving}
                  className={secondaryBtnClass}
                  style={secondaryBtnStyle}
                >
                  Отмена
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void handleTestGiphyKey()}
              disabled={!canTestGiphyKey || giphyTest.status === "checking" || giphyKeySaving}
              className={secondaryBtnClass}
              style={secondaryBtnStyle}
              title={canTestGiphyKey ? undefined : "Сначала введите или сохраните ключ"}
            >
              {giphyTest.status === "checking" ? (
                <span className="inline-flex items-center gap-1.5">
                  <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                  Проверка…
                </span>
              ) : (
                "Проверить"
              )}
            </button>
            {giphyKeyNote && (
              <span className="text-xs" style={LABEL_STYLE}>
                {giphyKeyNote}
              </span>
            )}
          </div>
          {giphyTest.status === "success" && (
            <div
              className="mt-2 rounded-lg px-3 py-2 text-xs text-white"
              style={{ backgroundColor: "rgba(62, 207, 95, 0.12)", border: "1px solid #3ecf5f" }}
            >
              <span className="font-semibold" style={{ color: "#3ecf5f" }}>
                Ключ принят
              </span>
              {" — "}
              Giphy отвечает, загрузка стикеров работает
              {giphyTest.stickerCount > 0
                ? ` (тестовый запрос вернул ${giphyTest.stickerCount} стикер${giphyTest.stickerCount === 1 ? "" : giphyTest.stickerCount < 5 ? "а" : "ов"})`
                : " (тестовый запрос прошёл успешно)"}
              .
            </div>
          )}
          {giphyTest.status === "error" && (
            <div
              className="mt-2 rounded-lg px-3 py-2 text-xs text-white"
              style={{ backgroundColor: "rgba(241, 70, 104, 0.12)", border: "1px solid #f14668" }}
            >
              <span className="font-semibold" style={{ color: "#f14668" }}>
                Ключ не принят
              </span>
              {" — "}
              {giphyTest.message}
            </div>
          )}
          {giphyKeyEditing && giphyKeyForTest.length > 0 && giphyTest.status === "idle" && (
            <span className="text-xs" style={LABEL_STYLE}>
              Можно проверить ключ до сохранения — нажмите «Проверить».
            </span>
          )}
        </label>
        {!config.giphyKeyConfigured && !giphyKeyEditing && (
          <span className="pl-6 text-xs" style={{ color: "#f5b301" }}>
            Ключ не задан — источник включён, но ничего докачивать не будет. Бесплатный ключ: developers.giphy.com
            (можно также задать через GIPHY_API_KEY в .env точки).
          </span>
        )}

        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            checked={config.cleanpngEnabled}
            onChange={(event) => patch({ cleanpngEnabled: event.target.checked })}
          />
          CleanPNG (экспериментально)
        </label>
        <span className="pl-6 text-xs" style={LABEL_STYLE}>
          CleanPNG часто блокирует автоматическое скачивание защитой Cloudflare — источник best-effort, может
          подолгу ничего не находить. Безопасно оставить включённым: при неудаче просто пропускается.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Карточек на странице
          <input
            type="number"
            min={1}
            value={config.pageSize}
            onChange={(event) => patch({ pageSize: Number(event.target.value) || 1 })}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>

        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Буфер (запас)
          <input
            type="number"
            min={1}
            value={config.bufferSize}
            onChange={(event) => patch({ bufferSize: Number(event.target.value) || 1 })}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>

        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Задержка между запросами (мс)
          <input
            type="number"
            min={0}
            step={100}
            value={config.requestDelayMs}
            onChange={(event) => patch({ requestDelayMs: Number(event.target.value) || 0 })}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>

        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Макс. запросов в час
          <input
            type="number"
            min={1}
            value={config.maxRequestsPerHour}
            onChange={(event) => patch({ maxRequestsPerHour: Number(event.target.value) || 1 })}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>

        <label className="flex items-center gap-2 text-sm" style={LABEL_STYLE}>
          <input
            type="checkbox"
            checked={config.minResolutionEnabled}
            onChange={(event) => patch({ minResolutionEnabled: event.target.checked })}
          />
          Фильтр по мин. разрешению
        </label>

        {config.minResolutionEnabled && (
          <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
            Мин. разрешение (px)
            <input
              type="number"
              min={1}
              value={config.minResolutionPx}
              onChange={(event) => patch({ minResolutionPx: Number(event.target.value) || 1 })}
              className={FIELD_INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        {savedNote && (
          <span className="text-sm" style={LABEL_STYLE}>
            {savedNote}
          </span>
        )}
      </div>
    </div>
  );
}

/** One category's editable list of search query tags, inside `CategoryCard`. */
function CategoryQueryTagsEditor({
  item,
  onSaved,
}: {
  item: CategoryQueryTags;
  onSaved: (updated: CategoryQueryTags) => void;
}) {
  const [tags, setTags] = useState<string[]>(item.tags);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    setTags(item.tags);
  }, [item.tags]);

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((existing) => existing !== tag));
  }

  async function handleSave() {
    if (tags.length === 0) return;
    setSaving(true);
    setSavedNote(null);
    try {
      const updated = await updateQueryTags(item.category, tags);
      onSaved(updated);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-white"
            style={{ backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Удалить тег ${tag}`}
              className="opacity-70 transition-opacity hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs" style={LABEL_STYLE}>
            Нет тегов — добавьте хотя бы один
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="новый тег, напр. anime png"
          className={FIELD_INPUT_CLASS}
          style={{ backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }}
        />
        <button
          type="button"
          onClick={addTag}
          className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold text-white"
          style={{ border: "1px solid var(--operator-card-border)" }}
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || tags.length === 0}
          className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
        >
          {saving ? "Сохранение…" : "Сохранить теги"}
        </button>
        {savedNote && (
          <span className="text-xs" style={LABEL_STYLE}>
            {savedNote}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Combined per-category card — health/manual-run + search tags in one place
 * (used to be two separate lists) — the "Категории" tab.
 */
function CategoryCard({
  status,
  tags,
  onTriggerRun,
  triggering,
  onTagsSaved,
}: {
  status: CatalogScrapeStatus | undefined;
  tags: CategoryQueryTags | undefined;
  onTriggerRun: (category: GalleryCategory) => void;
  triggering: boolean;
  onTagsSaved: (updated: CategoryQueryTags) => void;
}) {
  if (!status) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--operator-page-bg)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold text-white">{CATEGORY_LABELS[status.category]}</span>
        <div className="flex items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: STATUS_COLORS[status.status] }}
          >
            {status.status === "running" && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
            {STATUS_LABELS[status.status]}
          </span>
          <button
            type="button"
            onClick={() => onTriggerRun(status.category)}
            disabled={status.status === "running" || triggering}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ border: "1px solid var(--operator-card-border)" }}
          >
            Докачать сейчас
          </button>
        </div>
      </div>
      <span className="text-xs" style={LABEL_STYLE}>
        Последний запуск: {formatRunDate(status.lastRunAt)} · скачано {status.lastDownloadedCount} · всего{" "}
        {status.totalDownloaded}
      </span>
      {status.lastError && (
        <span className="text-xs" style={{ color: "#f14668" }}>
          {status.lastError}
        </span>
      )}
      {tags && (
        <>
          <div className="h-px w-full" style={{ backgroundColor: "var(--operator-card-border)" }} />
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={LABEL_STYLE}>
            <Tag className="h-3.5 w-3.5" />
            Поисковые теги
          </span>
          <CategoryQueryTagsEditor item={tags} onSaved={onTagsSaved} />
        </>
      )}
    </div>
  );
}

/**
 * Per-category scrape health, manual "Докачать сейчас" trigger, and search
 * tags — merged into one card per category (Этап 3) — the "Категории" tab.
 */
function CategoriesTab() {
  const [statuses, setStatuses] = useState<CatalogScrapeStatus[]>([]);
  const [tagsByCategory, setTagsByCategory] = useState<CategoryQueryTags[]>([]);
  const [triggering, setTriggering] = useState<GalleryCategory | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchScrapeStatus()
        .then((rows) => !cancelled && setStatuses(rows))
        .catch(() => undefined);
    }
    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchQueryTags()
      .then(setTagsByCategory)
      .catch(() => undefined);
  }, []);

  async function handleTrigger(category: GalleryCategory) {
    setTriggering(category);
    try {
      await triggerScrapeRun(category);
    } catch {
      // fail-open: status list will just keep showing the previous state
    } finally {
      setTriggering(null);
    }
  }

  if (statuses.length === 0) {
    return (
      <p style={LABEL_STYLE} className="text-base">
        Загрузка…
      </p>
    );
  }

  return (
    <div className={CARD_CLASS} style={CARD_STYLE}>
      <span className="font-bold text-white">Категории каталога</span>
      <span className="text-xs" style={LABEL_STYLE}>
        Общие для всех источников (Pinterest, Giphy, CleanPNG) поисковые теги — каждый источник пробует их по
        очереди, пока не наберёт нужное количество картинок.
      </span>
      {statuses.map((status) => (
        <CategoryCard
          key={status.category}
          status={status}
          tags={tagsByCategory.find((item) => item.category === status.category)}
          onTriggerRun={(category) => void handleTrigger(category)}
          triggering={triggering === status.category}
          onTagsSaved={(updated) =>
            setTagsByCategory((prev) =>
              prev.map((existing) => (existing.category === updated.category ? updated : existing)),
            )
          }
        />
      ))}
    </div>
  );
}

const GALLERY_PAGE_SIZE = 24;

/** Extra pseudo-category chip — designs stay tagged with their real `category`, isolation is just a filter. */
const ISOLATED_FILTER = "isolated" as const;
type GalleryFilter = DesignCategory | typeof ISOLATED_FILTER;

/**
 * Filterable/paginated grid of already-downloaded designs, with per-image
 * delete/isolate and a per-category bulk-clear action — the "Галерея" tab.
 * Uses the same paginated endpoint as the kiosk gallery (`fetchDesignsPage`)
 * instead of loading the whole catalog at once, since the cache can now grow
 * to several GB / thousands of images (docs/PLAN.md "кэш картинок по ГБ").
 *
 * A design an operator "isolates" (see `setDesignIsolated`) disappears from
 * its normal category here and from the kiosk gallery, but isn't deleted —
 * it only shows up under the dedicated "Изолированные" filter, from where it
 * can be restored or deleted for good.
 */
function GalleryTab() {
  const [category, setCategory] = useState<GalleryFilter>("memes");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isolatingId, setIsolatingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const isIsolatedView = category === ISOLATED_FILTER;

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDesignsPage(isIsolatedView ? undefined : category, {
      search: search || undefined,
      offset: 0,
      limit: GALLERY_PAGE_SIZE,
      isolated: isIsolatedView,
    })
      .then((page) => {
        if (cancelled) return;
        setDesigns(page.items);
        setTotal(page.total);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, isIsolatedView, search]);

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      const page = await fetchDesignsPage(isIsolatedView ? undefined : category, {
        search: search || undefined,
        offset: designs.length,
        limit: GALLERY_PAGE_SIZE,
        isolated: isIsolatedView,
      });
      setDesigns((prev) => appendDesignPage(prev, page.items));
      setTotal(page.total);
    } catch {
      // fail-open: keep whatever's already loaded
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDesign(id);
      setDesigns((prev) => prev.filter((design) => design.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
      // fail-open: card stays in the grid
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleIsolated(design: Design) {
    setIsolatingId(design.id);
    try {
      await setDesignIsolated(design.id, !design.isolated);
      // Either filter (a category, or "Изолированные") only ever shows one
      // side of the flag, so a successful toggle always means "remove from
      // the list currently on screen".
      setDesigns((prev) => prev.filter((item) => item.id !== design.id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch {
      // fail-open: card stays put, operator can retry
    } finally {
      setIsolatingId(null);
    }
  }

  async function handleClearCategory() {
    if (isIsolatedView) return;
    const label = CATEGORY_LABELS[category] ?? category;
    if (!window.confirm(`Удалить все картинки категории «${label}» (${total} шт.)? Это освободит место в кэше.`)) {
      return;
    }
    setClearing(true);
    try {
      // Admin-panel uploads are excluded server-side (read-only on the
      // point) — re-fetch instead of assuming the category is now empty,
      // so any of those stay visible in the grid.
      await deleteDesignsByCategory(category);
      const page = await fetchDesignsPage(category, { offset: 0, limit: GALLERY_PAGE_SIZE });
      setDesigns(page.items);
      setTotal(page.total);
    } catch {
      // fail-open: grid stays as-is, operator can retry
    } finally {
      setClearing(false);
    }
  }

  const hasMore = designs.length < total;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {ALL_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className="rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity"
            style={
              category === item
                ? { backgroundColor: "var(--brand-primary, #ec4899)" }
                : { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }
            }
          >
            {CATEGORY_LABELS[item] ?? item}
          </button>
        ))}
        <span className="mx-1 h-5 w-px" style={{ backgroundColor: "var(--operator-card-border)" }} />
        <button
          type="button"
          onClick={() => setCategory(ISOLATED_FILTER)}
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity"
          style={
            isIsolatedView
              ? { backgroundColor: "#f14668" }
              : { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }
          }
        >
          <Lock className="h-3.5 w-3.5" />
          Изолированные
        </button>
      </div>
      {isIsolatedView && (
        <span className="text-xs" style={LABEL_STYLE}>
          Эти картинки скрыты из галереи киоска и не отображаются в своей обычной категории. Нажмите «Вернуть»,
          чтобы снова показывать картинку покупателям.
        </span>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2"
          style={{ minWidth: "220px", ...INPUT_STYLE }}
        >
          <SearchIcon className="h-4 w-4 flex-shrink-0" style={LABEL_STYLE} />
          <input
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Поиск по названию…"
            className="w-full bg-transparent text-sm text-white outline-none"
          />
        </div>
        <span className="text-xs" style={LABEL_STYLE}>
          {loading ? "Загрузка…" : `Показано ${designs.length} из ${total}`}
        </span>
        {!isIsolatedView && (
          <button
            type="button"
            onClick={() => void handleClearCategory()}
            disabled={clearing || total === 0}
            className="ml-auto flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#f14668" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {clearing ? "Удаление…" : "Очистить категорию"}
          </button>
        )}
      </div>

      {loading && (
        <p style={LABEL_STYLE} className="text-base">
          Загрузка…
        </p>
      )}
      {!loading && designs.length === 0 && (
        <p style={LABEL_STYLE} className="text-base">
          {search ? "Ничего не найдено" : isIsolatedView ? "Нет изолированных картинок" : "В этой категории пока нет картинок"}
        </p>
      )}

      {!loading && designs.length > 0 && (
        <>
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
                <div
                  className="relative flex aspect-square items-center justify-center"
                  style={{ backgroundColor: "var(--operator-page-bg)" }}
                >
                  {design.imageUrl ? (
                    <img
                      src={resolveDesignImageUrl(design.imageUrl)}
                      alt={design.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <PhotoIcon
                      style={{
                        width: "var(--operator-designs-icon-size)",
                        height: "var(--operator-designs-icon-size)",
                        color: "var(--operator-text-muted)",
                      }}
                    />
                  )}
                  {design.imageUrl && design.source === "admin" && (
                    <span
                      className="absolute right-2 top-2 rounded-full px-2 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
                      title="Загружено из панели администратора — управлять можно только там"
                    >
                      Из админки
                    </span>
                  )}
                  {design.imageUrl && design.source !== "admin" && (
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleIsolated(design)}
                        disabled={isolatingId === design.id}
                        aria-label={design.isolated ? `Вернуть ${design.title}` : `Изолировать ${design.title}`}
                        title={
                          design.isolated
                            ? "Вернуть в галерею киоска"
                            : "Изолировать — скрыть из галереи киоска, не удаляя"
                        }
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: design.isolated ? "#3ecf5f" : "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" }}
                      >
                        {isolatingId === design.id ? (
                          <SpinnerIcon className="h-3 w-3 animate-spin" />
                        ) : design.isolated ? (
                          <>
                            <LockOpen className="h-3 w-3" />
                            Вернуть
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            Изолировать
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(design.id)}
                        disabled={deletingId === design.id}
                        aria-label={`Удалить ${design.title}`}
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: "#f14668" }}
                      >
                        {deletingId === design.id ? <SpinnerIcon className="h-3 w-3 animate-spin" /> : "Удалить"}
                      </button>
                    </div>
                  )}
                  {design.useCount > 0 && (
                    <span
                      className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.65)" }}
                      title="Сколько раз напечатали с этой картинкой"
                    >
                      <Heart className="h-3 w-3" fill="var(--brand-primary, #ec4899)" stroke="none" />
                      {design.useCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1" style={{ padding: "var(--operator-designs-card-padding)" }}>
                  <span
                    className="truncate font-semibold text-white"
                    style={{ fontSize: "var(--operator-designs-card-title-size)" }}
                  >
                    {design.title}
                  </span>
                  <span style={{ fontSize: "var(--operator-designs-card-category-size)", color: "var(--operator-text-muted)" }}>
                    {CATEGORY_LABELS[design.category] ?? design.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
                className="rounded-full px-6 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }}
              >
                {loadingMore ? "Загрузка…" : "Показать ещё"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type DesignsTab = "overview" | "sources" | "categories" | "gallery";

const TABS: { id: DesignsTab; label: string; icon: typeof HardDrive }[] = [
  { id: "overview", label: "Обзор", icon: HardDrive },
  { id: "sources", label: "Источники", icon: SlidersHorizontal },
  { id: "categories", label: "Категории", icon: Tag },
  { id: "gallery", label: "Галерея", icon: LayoutGrid },
];

/**
 * Sidebar's "Дизайны" item — cache usage/limit, scraper source settings,
 * per-category health/tags, and a filterable image gallery, split into
 * tabs for clarity (docs/PLAN.md "кэш картинок по ГБ"). Sizes/spacing of
 * the gallery grid are `--operator-designs-*` CSS tokens, live tunable via
 * `OperatorThemePanel`.
 */
export function DesignsPanel() {
  const [tab, setTab] = useState<DesignsTab>("overview");

  return (
    <div
      className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{ padding: "var(--operator-designs-padding-y) var(--operator-designs-padding-x)" }}
    >
      <h2 className="mb-4 font-extrabold text-white" style={{ fontSize: "var(--operator-designs-title-size)" }}>
        Каталог дизайнов
      </h2>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity"
              style={
                active
                  ? { backgroundColor: "var(--brand-primary, #ec4899)" }
                  : { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" }
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <CacheOverviewPanel />}
      {tab === "sources" && <ScrapeConfigForm />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "gallery" && <GalleryTab />}
    </div>
  );
}
