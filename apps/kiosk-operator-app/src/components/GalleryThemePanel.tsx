import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { GripVertical, Palette } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  settingsSectionId,
} from "./settingsPanelUi.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";
import { THEME_PANEL_CHROME_ATTR } from "../lib/themePick.js";
import { useDesignPanelPick } from "../lib/useDesignPanelPick.js";

const THEME_SAVE_PATH = "/__kiosk/save-theme-defaults";

interface ColorToken {
  key: string;
  label: string;
  type: "color";
  defaultValue: string;
}

interface RangeToken {
  key: string;
  label: string;
  type: "range";
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

type Token = ColorToken | RangeToken;

interface Section {
  title: string;
  tokens: Token[];
}

const PADDING_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 80,
  step: 1,
  unit: "px",
};

const GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 64,
  step: 1,
  unit: "px",
};

const FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 8,
  max: 60,
  step: 1,
  unit: "px",
};

const SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 16,
  max: 220,
  step: 1,
  unit: "px",
};

const ICON_SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 12,
  max: 48,
  step: 1,
  unit: "px",
};

const RADIUS_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 60,
  step: 1,
  unit: "px",
};

const RADIUS_FULL: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 999,
  step: 1,
  unit: "px",
};

const BORDER_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 8,
  step: 0.5,
  unit: "px",
};

const OPACITY_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 0,
  max: 1,
  step: 0.05,
};

const GLOW_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 0,
  max: 3,
  step: 0.1,
};

const COLUMNS_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 2,
  max: 4,
  step: 1,
};

/**
 * Every tunable category-gallery token, grouped the same way as the panel's
 * UI. Values here MUST match the defaults declared in `index.css` — this is
 * the single list the panel reads/writes, and what "Сброс" restores.
 */
const SECTIONS: Section[] = [
  {
    title: "Отступы страницы",
    tokens: [
      { key: "--gallery-page-padding-x", label: "Отступы по бокам", defaultValue: 40, ...PADDING_RANGE },
      { key: "--gallery-page-padding-y", label: "Отступы сверху/снизу", defaultValue: 40, ...PADDING_RANGE },
      { key: "--gallery-page-section-gap", label: "Между шапкой / поиском / сеткой", defaultValue: 32, ...GAP_RANGE },
    ],
  },
  {
    title: "Скроллбар",
    tokens: [
      {
        key: "--gallery-scroll-size",
        label: "Ширина",
        type: "range",
        defaultValue: 8,
        min: 2,
        max: 20,
        step: 1,
        unit: "px",
      },
      { key: "--gallery-scroll-track-color", label: "Дорожка — цвет", type: "color", defaultValue: "#242938" },
      { key: "--gallery-scroll-track-opacity", label: "Дорожка — прозрачность", defaultValue: 0.45, ...OPACITY_RANGE },
      { key: "--gallery-scroll-thumb-color", label: "Ползунок — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--gallery-scroll-thumb-opacity", label: "Ползунок — прозрачность", defaultValue: 0.72, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Шапка",
    tokens: [
      { key: "--gallery-back-btn-height", label: "Кнопка «назад» — высота", defaultValue: 48, ...SIZE_RANGE },
      { key: "--gallery-back-btn-radius", label: "Кнопка «назад» — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--gallery-back-btn-bg", label: "Кнопка «назад» — фон", type: "color", defaultValue: "#131a2e" },
      {
        key: "--gallery-back-btn-border-width",
        label: "Кнопка «назад» — обводка толщина",
        defaultValue: 2,
        ...BORDER_WIDTH_RANGE,
      },
      {
        key: "--gallery-back-btn-border-color",
        label: "Кнопка «назад» — обводка цвет",
        type: "color",
        defaultValue: "#26325a",
      },
      { key: "--gallery-back-btn-font-size", label: "Кнопка «назад» — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--gallery-header-title-size", label: "Заголовок — размер", defaultValue: 28, ...FONT_RANGE },
      { key: "--gallery-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
    ],
  },
  {
    title: "Поиск",
    tokens: [
      { key: "--gallery-search-height", label: "Высота", defaultValue: 56, ...SIZE_RANGE },
      { key: "--gallery-search-radius", label: "Скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--gallery-search-border-width", label: "Обводка — толщина", defaultValue: 2, ...BORDER_WIDTH_RANGE },
      { key: "--gallery-search-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#26325a" },
      { key: "--gallery-search-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#131a2e" },
      { key: "--gallery-search-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.72, ...OPACITY_RANGE },
      { key: "--gallery-search-icon-size", label: "Иконка — размер", defaultValue: 24, ...ICON_SIZE_RANGE },
      { key: "--gallery-search-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#cac9cb" },
      { key: "--gallery-search-font-size", label: "Текст — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--gallery-search-text-color", label: "Текст — цвет", type: "color", defaultValue: "#ffffff" },
    ],
  },
  {
    title: "Сетка карточек",
    tokens: [
      { key: "--gallery-grid-columns", label: "Колонок", defaultValue: 3, ...COLUMNS_RANGE },
      { key: "--gallery-grid-gap", label: "Зазор между карточками", defaultValue: 24, ...GAP_RANGE },
      { key: "--gallery-card-radius", label: "Скругление карточки", defaultValue: 24, ...RADIUS_RANGE },
      { key: "--gallery-card-border-width", label: "Обводка — толщина", defaultValue: 3, ...BORDER_WIDTH_RANGE },
      { key: "--gallery-card-padding", label: "Внутренний отступ (картинка)", defaultValue: 24, ...PADDING_RANGE },
      { key: "--gallery-card-bg-start", label: "Фон карточки — верх", type: "color", defaultValue: "#131a2e" },
      { key: "--gallery-card-bg-end", label: "Фон карточки — низ", type: "color", defaultValue: "#0a0d1a" },
      { key: "--gallery-card-dark-art-plate-hi", label: "Тёмный арт — подложка светлая", type: "color", defaultValue: "#f5f7fc" },
      { key: "--gallery-card-dark-art-plate", label: "Тёмный арт — подложка", type: "color", defaultValue: "#e4e9f4" },
      { key: "--gallery-card-dark-art-plate-lo", label: "Тёмный арт — подложка края", type: "color", defaultValue: "#c8d0e2" },
      { key: "--gallery-card-glow-strength", label: "Сила свечения рамки", defaultValue: 1, ...GLOW_RANGE },
      {
        key: "--gallery-card-icon-color",
        label: "Заглушка (без картинки) — цвет иконки",
        type: "color",
        defaultValue: "#a7b0d0",
      },
    ],
  },
  {
    title: "Карточка «Загрузка ещё»",
    tokens: [
      {
        key: "--gallery-card-loading-border-color",
        label: "Обводка — цвет",
        type: "color",
        defaultValue: "#26325a",
      },
      {
        key: "--gallery-card-loading-icon-color",
        label: "Крутилка — цвет",
        type: "color",
        defaultValue: "#a7b0d0",
      },
    ],
  },
  {
    title: "Цвета рамок карточек (циклом по порядку)",
    tokens: [
      { key: "--gallery-card-accent-1", label: "Цвет 1", type: "color", defaultValue: "#ff2d95" },
      { key: "--gallery-card-accent-2", label: "Цвет 2", type: "color", defaultValue: "#22d3f5" },
      { key: "--gallery-card-accent-3", label: "Цвет 3", type: "color", defaultValue: "#8b5cf6" },
      { key: "--gallery-card-accent-4", label: "Цвет 4", type: "color", defaultValue: "#14b8a6" },
      { key: "--gallery-card-accent-5", label: "Цвет 5", type: "color", defaultValue: "#2563eb" },
      { key: "--gallery-card-accent-6", label: "Цвет 6", type: "color", defaultValue: "#eab308" },
      { key: "--gallery-card-accent-7", label: "Цвет 7", type: "color", defaultValue: "#22c55e" },
    ],
  },
];

const PANEL_GROUPS: Array<{ label: string; titles: readonly string[] }> = [
  {
    label: "Основные",
    titles: ["Отступы страницы", "Скроллбар"],
  },
  {
    label: "Шапка и поиск",
    titles: ["Шапка", "Поиск"],
  },
  {
    label: "Сетка",
    titles: ["Сетка карточек", "Карточка «Загрузка ещё»", "Цвета рамок карточек (циклом по порядку)"],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const STORAGE_KEY = "kiosk-gallery-theme-overrides-v1";
const SCOPE_SELECTOR = ".gallery-theme-root";

function normalizeValue(token: Token, value: string): string {
  if (token.type === "color") return value;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return String(token.defaultValue);
  const clamped = Math.min(token.max, Math.max(token.min, numeric));
  return String(clamped);
}

function formatCssValue(token: Token, value: string): string {
  const normalized = normalizeValue(token, value);
  return token.type === "range" && token.unit ? `${normalized}${token.unit}` : normalized;
}

function readTokenDefault(token: Token): string {
  if (typeof document === "undefined") return String(token.defaultValue);
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token.key).trim();
  if (!raw) return String(token.defaultValue);
  if (token.type === "range" && token.unit && raw.endsWith(token.unit)) {
    return raw.slice(0, -token.unit.length);
  }
  return raw;
}

function readAllDefaults(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const token of ALL_TOKENS) {
    values[token.key] = readTokenDefault(token);
  }
  return values;
}

function getBaselineValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const token of ALL_TOKENS) {
    values[token.key] = String(token.defaultValue);
  }
  if (typeof document === "undefined") return values;
  return readAllDefaults();
}

function loadStoredValues(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const token = TOKEN_BY_KEY.get(key);
      if (!token) continue;
      normalized[key] = normalizeValue(token, value);
    }
    return normalized;
  } catch {
    return {};
  }
}

function applyValue(key: string, value: string) {
  const token = TOKEN_BY_KEY.get(key);
  if (!token) return;
  const cssValue = formatCssValue(token, value);
  document.documentElement.style.setProperty(key, cssValue);
  const galleryRoot = document.querySelector(SCOPE_SELECTOR);
  if (galleryRoot instanceof HTMLElement) {
    galleryRoot.style.setProperty(key, cssValue);
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const galleryRoot = document.querySelector(SCOPE_SELECTOR);
  if (galleryRoot instanceof HTMLElement) {
    galleryRoot.style.removeProperty(key);
  }
}

/**
 * Floating "design panel" for `/kiosk/category/:category` (the design gallery
 * grid), sibling to `ThemePanel` (kiosk home), `EditorThemePanel` and
 * `CheckoutThemePanel` — same mechanics: reads and writes the `--gallery-*`
 * custom properties declared in `index.css`, persists to localStorage, and
 * «Сохранить по умолчанию» writes the current values into `index.css`
 * (dev server only).
 */
export function GalleryThemePanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("gallery-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...getBaselineValues(),
    ...loadStoredValues(),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isGalleryRoute = /^\/kiosk\/category\//.test(location.pathname);
  const {
    activeSectionId,
    isOpen: isSectionOpen,
    toggle: toggleSection,
  } = useDesignPanelPick({
    active: isGalleryRoute && open,
    rootSelector: SCOPE_SELECTOR,
    sectionsStorageKey: "gallery-theme-panel-open-sections",
  });

  useEffect(() => {
    function applyAll() {
      for (const [key, value] of Object.entries(values)) {
        applyValue(key, value);
      }
    }
    applyAll();
    const frame = requestAnimationFrame(applyAll);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    for (const [key, value] of Object.entries(values)) {
      applyValue(key, value);
    }
  }, [open, values]);

  if (!isGalleryRoute) return null;

  function persist(next: Record<string, string>) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function handleChange(key: string, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
    applyValue(key, value);
  }

  function handleReset() {
    window.localStorage.removeItem(STORAGE_KEY);
    for (const token of ALL_TOKENS) {
      clearToken(token.key);
    }
    setValues(readAllDefaults());
  }

  function handleResetToken(token: Token) {
    clearToken(token.key);
    const defaultValue = readTokenDefault(token);
    setValues((prev) => {
      const next = { ...prev, [token.key]: defaultValue };
      persist(next);
      return next;
    });
  }

  async function handleSaveDefaults() {
    setSaveState("saving");
    try {
      const tokens: Record<string, string> = {};
      for (const token of ALL_TOKENS) {
        tokens[token.key] = formatCssValue(token, values[token.key] ?? String(token.defaultValue));
      }

      const response = await fetch(THEME_SAVE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }

      window.localStorage.removeItem(STORAGE_KEY);
      setSaveState("saved");
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      setSaveState("error");
      window.setTimeout(() => setSaveState("idle"), 2800);
    }
  }

  function renderToken(token: Token) {
    return (
      <div key={token.key} className="flex items-center justify-between gap-6 text-xl">
        <span className="min-w-[220px] text-white/80">{token.label}</span>
        {token.type === "color" ? (
          <input
            type="color"
            value={values[token.key] ?? token.defaultValue}
            onChange={(e) => handleChange(token.key, e.target.value)}
            className="h-14 w-24 cursor-pointer rounded-xl border-2 border-white/15 bg-transparent p-1"
          />
        ) : (
          <span className="flex flex-1 items-center gap-4">
            <input
              type="range"
              min={token.min}
              max={token.max}
              step={token.step}
              value={values[token.key] ?? String(token.defaultValue)}
              onChange={(e) => handleChange(token.key, e.target.value)}
              className="h-3 flex-1 cursor-pointer accent-[var(--brand-primary)]"
            />
            <input
              type="number"
              min={token.min}
              max={token.max}
              step={token.step}
              value={values[token.key] ?? String(token.defaultValue)}
              onChange={(e) => handleChange(token.key, e.target.value)}
              className="w-24 shrink-0 rounded-lg border-2 border-white/15 bg-[#171a28] px-2 py-1.5 text-right text-lg tabular-nums text-white outline-none transition-colors hover:border-white/30 focus:border-white/40"
            />
            {token.unit ? <span className="w-8 shrink-0 text-left text-base text-white/40">{token.unit}</span> : null}
          </span>
        )}
        <button
          type="button"
          onClick={() => handleResetToken(token)}
          className="shrink-0 rounded-full border-2 border-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-white/50 transition-colors hover:border-white/30 hover:text-white"
        >
          Сброс
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      {...{ [THEME_PANEL_CHROME_ATTR]: "" }}
      className="fixed right-6 top-[23.5rem] z-50 flex flex-col items-end gap-5"
      style={dragStyle}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки галереи категории"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <Palette aria-hidden className="h-10 w-10" strokeWidth={1.7} />
      </button>

      {open ? (
        <div className="settings-panel-scroll flex max-h-[80vh] w-[760px] flex-col gap-6 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                {...dragHandleProps}
                role="button"
                aria-label="Перетащить панель"
                tabIndex={-1}
                className="flex h-9 w-9 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white/80 active:cursor-grabbing"
              >
                <GripVertical aria-hidden className="h-5 w-5" />
              </span>
              <span className="text-2xl font-bold uppercase tracking-wide text-white/90">
                Настройки галереи категории
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border-2 border-white/15 px-5 py-2.5 text-base font-semibold uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Сброс
            </button>
          </div>

          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
            Кликните по элементу на экране, чтобы открыть его секцию. Рамки показывают границы блоков.
          </p>

          {PANEL_GROUPS.map((group) => (
            <SettingsPanelGroup key={group.label} label={group.label}>
              {pickSectionsByTitle(SECTIONS, group.titles).map((section) => {
                const id = settingsSectionId(section.title);
                return (
                  <SettingsPanelSection
                    key={section.title}
                    id={id}
                    title={section.title}
                    open={isSectionOpen(id)}
                    onToggle={() => toggleSection(id)}
                    highlighted={activeSectionId === id}
                  >
                    {section.tokens.map((token) => renderToken(token))}
                  </SettingsPanelSection>
                );
              })}
            </SettingsPanelGroup>
          ))}

          <button
            type="button"
            onClick={() => void handleSaveDefaults()}
            disabled={saveState === "saving" || saveState === "saved"}
            className="mt-2 rounded-2xl border-2 border-white/15 bg-white/5 py-4 text-xl font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === "saving"
              ? "Сохранение…"
              : saveState === "saved"
                ? "Сохранено ✓"
                : saveState === "error"
                  ? "Ошибка — только dev-сервер"
                  : "Сохранить по умолчанию"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
