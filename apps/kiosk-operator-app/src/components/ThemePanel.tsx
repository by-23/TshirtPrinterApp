import { useEffect, useState } from "react";
import { Settings } from "./icons.js";
import { DEFAULT_UI_FONT, THEME_FONT_OPTIONS } from "../lib/fonts.js";
import {
  getKioskImageUrl,
  KIOSK_IMAGE_SECTIONS,
  resetAllKioskImages,
  resetKioskImage,
  setKioskImageOverride,
  useKioskImageOverrides,
} from "../lib/kioskImages.js";

const THEME_FONT_SELECT_OPTIONS = THEME_FONT_OPTIONS.map(({ label, family }) => ({
  label,
  value: family,
}));

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

interface SelectToken {
  key: string;
  label: string;
  type: "select";
  defaultValue: string;
  options: Array<{ label: string; value: string }>;
}

type Token = ColorToken | RangeToken | SelectToken;

interface Section {
  title: string;
  tokens: Token[];
}

/**
 * Every tunable design token, grouped the same way as the panel's UI.
 * Values here MUST match the defaults declared in `index.css` — this is the
 * single list the panel reads/writes, and what "Reset" restores.
 */
const SECTIONS: Section[] = [
  {
    title: "Шрифт",
    tokens: [
      {
        key: "--font-family",
        label: "Шрифт интерфейса",
        type: "select",
        defaultValue: DEFAULT_UI_FONT,
        options: THEME_FONT_SELECT_OPTIONS,
      },
    ],
  },
  {
    title: "Бренд-градиент",
    tokens: [
      { key: "--brand-primary", label: "Цвет 1", type: "color", defaultValue: "#ff2d95" },
      { key: "--brand-secondary", label: "Цвет 2", type: "color", defaultValue: "#22d3f5" },
      { key: "--brand-tertiary", label: "Цвет 3", type: "color", defaultValue: "#8b5cf6" },
    ],
  },
  {
    title: "Скругления",
    tokens: [
      {
        key: "--radius-card",
        label: "Крупные карточки",
        type: "range",
        defaultValue: 32,
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
      },
      {
        key: "--radius-card-inner",
        label: "Внутренние панели",
        type: "range",
        defaultValue: 30,
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
      },
      {
        key: "--radius-card-sm",
        label: "Малые карточки",
        type: "range",
        defaultValue: 24,
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
      },
    ],
  },
  {
    title: "Свечение",
    tokens: [
      {
        key: "--glow-strength",
        label: "Интенсивность",
        type: "range",
        defaultValue: 1,
        min: 0,
        max: 2,
        step: 0.1,
      },
    ],
  },
  {
    title: "Карточки категорий",
    tokens: [
      {
        key: "--category-border-width",
        label: "Толщина обводки",
        type: "range",
        defaultValue: 2,
        min: 0,
        max: 8,
        step: 0.5,
        unit: "px",
      },
      {
        key: "--category-gradient-direction",
        label: "Направление градиента",
        type: "select",
        defaultValue: "to bottom",
        options: [
          { label: "Сверху вниз", value: "to bottom" },
          { label: "Снизу вверх", value: "to top" },
          { label: "Слева направо", value: "to right" },
          { label: "Справа налево", value: "to left" },
          { label: "Вниз вправо", value: "to bottom right" },
          { label: "Вниз влево", value: "to bottom left" },
          { label: "Вверх вправо", value: "to top right" },
          { label: "Вверх влево", value: "to top left" },
        ],
      },
      {
        key: "--category-title-size",
        label: "Заголовок — размер",
        type: "range",
        defaultValue: 21,
        min: 10,
        max: 48,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-subtitle-size",
        label: "Подпись — размер",
        type: "range",
        defaultValue: 11,
        min: 8,
        max: 24,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-text-gap",
        label: "Межстрочный зазор",
        type: "range",
        defaultValue: 6,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-text-offset-x",
        label: "Текст — смещение X",
        type: "range",
        defaultValue: 0,
        min: -120,
        max: 120,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-text-offset-y",
        label: "Текст — смещение Y",
        type: "range",
        defaultValue: 0,
        min: -120,
        max: 120,
        step: 1,
        unit: "px",
      },
    ],
  },
  {
    title: "Плашка «Выберите категорию»",
    tokens: [
      {
        key: "--category-select-border-width",
        label: "Толщина обводки",
        type: "range",
        defaultValue: 2,
        min: 0,
        max: 8,
        step: 0.5,
        unit: "px",
      },
      {
        key: "--category-select-radius",
        label: "Скругление",
        type: "range",
        defaultValue: 24,
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-glow-strength",
        label: "Сила свечения",
        type: "range",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.1,
      },
      { key: "--category-select-bg-start", label: "Фон верх", type: "color", defaultValue: "#0b0f1e" },
      { key: "--category-select-bg-end", label: "Фон низ", type: "color", defaultValue: "#070a14" },
      {
        key: "--category-select-icon-size",
        label: "Иконка — размер",
        type: "range",
        defaultValue: 52,
        min: 24,
        max: 96,
        step: 1,
        unit: "px",
      },
      { key: "--category-select-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#ff2d95" },
      {
        key: "--category-select-title-size",
        label: "Заголовок — размер",
        type: "range",
        defaultValue: 22,
        min: 10,
        max: 48,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-subtitle-size",
        label: "Подпись — размер",
        type: "range",
        defaultValue: 13,
        min: 8,
        max: 24,
        step: 1,
        unit: "px",
      },
      { key: "--category-select-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      {
        key: "--category-select-subtitle-opacity",
        label: "Подпись — прозрачность",
        type: "range",
        defaultValue: 0.7,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "--category-select-text-gap",
        label: "Межстрочный зазор",
        type: "range",
        defaultValue: 4,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-content-gap",
        label: "Зазор иконка — текст",
        type: "range",
        defaultValue: 24,
        min: 0,
        max: 64,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-padding-x",
        label: "Отступы по X",
        type: "range",
        defaultValue: 32,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-padding-y",
        label: "Отступы по Y",
        type: "range",
        defaultValue: 42,
        min: 0,
        max: 80,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-offset-x",
        label: "Смещение X",
        type: "range",
        defaultValue: 0,
        min: -120,
        max: 120,
        step: 1,
        unit: "px",
      },
      {
        key: "--category-select-offset-y",
        label: "Смещение Y",
        type: "range",
        defaultValue: 0,
        min: -120,
        max: 120,
        step: 1,
        unit: "px",
      },
    ],
  },
  {
    title: "Популярные принты",
    tokens: [
      {
        key: "--popular-border-width",
        label: "Толщина обводки",
        type: "range",
        defaultValue: 2,
        min: 0,
        max: 8,
        step: 0.5,
        unit: "px",
      },
      {
        key: "--popular-glow-strength",
        label: "Сила свечения",
        type: "range",
        defaultValue: 1,
        min: 0,
        max: 3,
        step: 0.1,
      },
      {
        key: "--popular-bg-direction",
        label: "Направление фона",
        type: "select",
        defaultValue: "to bottom",
        options: [
          { label: "Сверху вниз", value: "to bottom" },
          { label: "Снизу вверх", value: "to top" },
          { label: "Слева направо", value: "to right" },
          { label: "Справа налево", value: "to left" },
          { label: "Вниз вправо", value: "to bottom right" },
          { label: "Вниз влево", value: "to bottom left" },
          { label: "Вверх вправо", value: "to top right" },
          { label: "Вверх влево", value: "to top left" },
        ],
      },
      { key: "--popular-bg-start", label: "Градиент верх", type: "color", defaultValue: "#131a2e" },
      { key: "--popular-bg-middle", label: "Градиент центр", type: "color", defaultValue: "#0b0f1e" },
      { key: "--popular-bg-end", label: "Градиент низ", type: "color", defaultValue: "#05060f" },
    ],
  },
  {
    title: "Градиенты категорий",
    tokens: [
      { key: "--cat-memes-start", label: "Мемы верх", type: "color", defaultValue: "#4f2db8" },
      { key: "--cat-memes-middle", label: "Мемы центр", type: "color", defaultValue: "#1f123f" },
      { key: "--cat-memes-end", label: "Мемы низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-memes-border", label: "Мемы обводка", type: "color", defaultValue: "#a78bfa" },

      { key: "--cat-anime-start", label: "Аниме верх", type: "color", defaultValue: "#8b174f" },
      { key: "--cat-anime-middle", label: "Аниме центр", type: "color", defaultValue: "#3a0d24" },
      { key: "--cat-anime-end", label: "Аниме низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-anime-border", label: "Аниме обводка", type: "color", defaultValue: "#e879f9" },

      { key: "--cat-games-start", label: "Игры верх", type: "color", defaultValue: "#1d4f96" },
      { key: "--cat-games-middle", label: "Игры центр", type: "color", defaultValue: "#10234b" },
      { key: "--cat-games-end", label: "Игры низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-games-border", label: "Игры обводка", type: "color", defaultValue: "#60a5fa" },

      { key: "--cat-text-start", label: "Надпись верх", type: "color", defaultValue: "#147c73" },
      { key: "--cat-text-middle", label: "Надпись центр", type: "color", defaultValue: "#0c3d3e" },
      { key: "--cat-text-end", label: "Надпись низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-text-border", label: "Надпись обводка", type: "color", defaultValue: "#5eead4" },

      { key: "--cat-custom-start", label: "Свой дизайн верх", type: "color", defaultValue: "#8f5a08" },
      { key: "--cat-custom-middle", label: "Свой дизайн центр", type: "color", defaultValue: "#3d2208" },
      { key: "--cat-custom-end", label: "Свой дизайн низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-custom-border", label: "Свой дизайн обводка", type: "color", defaultValue: "#fbbf24" },

      { key: "--cat-ai-start", label: "ИИ верх", type: "color", defaultValue: "#5a2398" },
      { key: "--cat-ai-middle", label: "ИИ центр", type: "color", defaultValue: "#211042" },
      { key: "--cat-ai-end", label: "ИИ низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-ai-border", label: "ИИ обводка", type: "color", defaultValue: "#c084fc" },
    ],
  },
];

/** Popular carousel image scale — rendered inside the «Изображения» block. */
const IMAGE_SIZE_TOKENS: RangeToken[] = [
  {
    key: "--popular-shirt-scale",
    label: "Футболки",
    type: "range",
    defaultValue: 1.32,
    min: 0.5,
    max: 2.5,
    step: 0.05,
  },
  {
    key: "--popular-print-scale",
    label: "Принты на футболках",
    type: "range",
    defaultValue: 1,
    min: 0.3,
    max: 2.5,
    step: 0.05,
  },
];

interface CategoryImageLayoutSection {
  title: string;
  tokens: RangeToken[];
}

const OFFSET_RANGE = {
  min: -200,
  max: 200,
  step: 1,
  unit: "px" as const,
};

function categoryLayoutTokens(prefix: string): RangeToken[] {
  return [
    {
      key: `--cat-${prefix}-image-scale`,
      label: "Размер",
      type: "range",
      defaultValue: 1,
      min: 0.3,
      max: 5,
      step: 0.05,
    },
    {
      key: `--cat-${prefix}-image-offset-x`,
      label: "Смещение по X",
      type: "range",
      defaultValue: 0,
      ...OFFSET_RANGE,
    },
    {
      key: `--cat-${prefix}-image-offset-y`,
      label: "Смещение по Y",
      type: "range",
      defaultValue: 0,
      ...OFFSET_RANGE,
    },
  ];
}

/** Per-category image scale and offset (from card bottom). */
const CATEGORY_IMAGE_LAYOUT_SECTIONS: CategoryImageLayoutSection[] = [
  { title: "МЕМЫ", tokens: categoryLayoutTokens("memes") },
  { title: "АНИМЕ", tokens: categoryLayoutTokens("anime") },
  { title: "ИГРЫ", tokens: categoryLayoutTokens("games") },
  { title: "НАДПИСЬ", tokens: categoryLayoutTokens("text") },
  { title: "СВОЙ ДИЗАЙН", tokens: categoryLayoutTokens("custom") },
  { title: "ИИ СТИЛИ", tokens: categoryLayoutTokens("ai") },
];

const CATEGORY_IMAGE_LAYOUT_TOKENS = CATEGORY_IMAGE_LAYOUT_SECTIONS.flatMap((section) => section.tokens);

const ALL_TOKENS: Token[] = [
  ...SECTIONS.flatMap((section) => section.tokens),
  ...IMAGE_SIZE_TOKENS,
  ...CATEGORY_IMAGE_LAYOUT_TOKENS,
];
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const STORAGE_KEY = "kiosk-theme-overrides";

function normalizeValue(token: Token, value: string): string {
  if (token.type === "color") return value;
  if (token.type === "select") {
    return token.options.some((option) => option.value === value) ? value : token.defaultValue;
  }

  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return String(token.defaultValue);
  const clamped = Math.min(token.max, Math.max(token.min, numeric));
  return String(clamped);
}

function formatCssValue(token: Token, value: string): string {
  const normalized = normalizeValue(token, value);
  return token.type === "range" && token.unit ? `${normalized}${token.unit}` : normalized;
}

function cssRawToState(token: Token, raw: string): string {
  if (token.type === "range" && token.unit && raw.endsWith(token.unit)) {
    return raw.slice(0, -token.unit.length);
  }
  return raw;
}

function getBaselineValues(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const token of ALL_TOKENS) {
    values[token.key] = String(token.defaultValue);
  }

  if (typeof document === "undefined") return values;

  const styles = getComputedStyle(document.documentElement);
  for (const token of ALL_TOKENS) {
    const raw = styles.getPropertyValue(token.key).trim();
    if (raw) {
      values[token.key] = cssRawToState(token, raw);
    }
  }
  return values;
}

function defaultValues(): Record<string, string> {
  return getBaselineValues();
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
  const kioskRoot = document.querySelector(".kiosk-theme-root");
  if (kioskRoot instanceof HTMLElement) {
    kioskRoot.style.setProperty(key, cssValue);
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const kioskRoot = document.querySelector(".kiosk-theme-root");
  if (kioskRoot instanceof HTMLElement) {
    kioskRoot.style.removeProperty(key);
  }
}

/**
 * Floating "design panel" for retuning the kiosk's brand colors, corner radii,
 * glow intensity and per-category accent colors live — no rebuild needed.
 * Everything here is just reading/writing the CSS custom properties declared
 * in `index.css`, which every themed component (Banner, CategoryGrid,
 * LanguageSwitcher) reads from. Changes persist to localStorage so they
 * survive a reload; «Сохранить по умолчанию» writes the current values into
 * `index.css` (dev server only) so they become the shipped baseline.
 */
export function ThemePanel() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...getBaselineValues(),
    ...loadStoredValues(),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const imageOverrides = useKioskImageOverrides();

  useEffect(() => {
    function applyAll() {
      for (const [key, value] of Object.entries(values)) {
        applyValue(key, value);
      }
    }
    applyAll();
    const frame = requestAnimationFrame(applyAll);
    return () => cancelAnimationFrame(frame);
    // Only ever run once on mount — per-token updates happen in handleChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    for (const [key, value] of Object.entries(values)) {
      applyValue(key, value);
    }
  }, [open, values]);

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
    const defaults = defaultValues();
    setValues(defaults);
    for (const token of ALL_TOKENS) {
      clearToken(token.key);
    }
    window.localStorage.removeItem(STORAGE_KEY);
    resetAllKioskImages();
    for (const [key, value] of Object.entries(defaults)) {
      applyValue(key, value);
    }
  }

  function handleResetToken(token: Token) {
    const defaultValue = getBaselineValues()[token.key] ?? String(token.defaultValue);
    setValues((prev) => {
      const next = { ...prev, [token.key]: defaultValue };
      persist(next);
      return next;
    });
    applyValue(token.key, defaultValue);
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

  function handleImagePick(key: string, file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setKioskImageOverride(key, reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  function renderToken(token: Token) {
    return (
      <div key={token.key} className="flex items-center justify-between gap-6 text-xl">
        <span className="min-w-[180px] text-white/80">{token.label}</span>
        {token.type === "color" ? (
          <input
            type="color"
            value={values[token.key] ?? token.defaultValue}
            onChange={(e) => handleChange(token.key, e.target.value)}
            className="h-14 w-24 cursor-pointer rounded-xl border-2 border-white/15 bg-transparent p-1"
          />
        ) : token.type === "range" ? (
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
            <span className="w-16 shrink-0 text-right text-lg tabular-nums text-white/60">
              {values[token.key] ?? token.defaultValue}
              {token.unit ?? ""}
            </span>
          </span>
        ) : (
          <select
            value={values[token.key] ?? token.defaultValue}
            onChange={(e) => handleChange(token.key, e.target.value)}
            className="min-w-[260px] rounded-xl border-2 border-white/15 bg-[#171a28] px-4 py-3 text-lg text-white outline-none transition-colors hover:border-white/30 focus:border-white/40"
            style={{ fontFamily: values[token.key] ?? token.defaultValue }}
          >
            {token.options.map((option) => (
              <option key={option.value} value={option.value} style={{ fontFamily: option.value }}>
                {option.label}
              </option>
            ))}
          </select>
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
    <div className="fixed right-6 top-6 z-50 flex flex-col items-end gap-5 font-sans">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки оформления"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <Settings aria-hidden className="h-10 w-10" strokeWidth={1.5} />
      </button>

      {open ? (
        <div className="flex max-h-[90vh] w-[720px] flex-col gap-8 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold uppercase tracking-wide text-white/90">
              Дизайн-панель
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border-2 border-white/15 px-5 py-2.5 text-base font-semibold uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Сброс
            </button>
          </div>

          {SECTIONS.slice(0, 2).map((section) => (
            <div key={section.title} className="flex flex-col gap-5">
              <span className="text-base font-bold uppercase tracking-wider text-white/50">
                {section.title}
              </span>
              {section.tokens.map((token) => renderToken(token))}
            </div>
          ))}

          <div className="flex flex-col gap-8">
            <span className="text-base font-bold uppercase tracking-wider text-white/50">
              Изображения
            </span>

            <div className="flex flex-col gap-5 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-5">
              <span className="text-sm font-bold uppercase tracking-wider text-white/40">
                Популярные принты — размеры
              </span>
              {IMAGE_SIZE_TOKENS.map((token) => renderToken(token))}
            </div>

            <div className="flex flex-col gap-6 rounded-2xl border-2 border-white/10 bg-white/[0.03] p-5">
              <span className="text-sm font-bold uppercase tracking-wider text-white/40">
                Категории — размер и позиция
              </span>
              <p className="text-sm text-white/45">
                Привязка к нижнему краю. X: минус — влево, плюс — вправо. Y: минус — вверх, плюс — вниз.
              </p>
              {CATEGORY_IMAGE_LAYOUT_SECTIONS.map((section) => (
                <div key={section.title} className="flex flex-col gap-4 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
                  <span className="text-sm font-bold uppercase tracking-wider text-white/35">
                    {section.title}
                  </span>
                  {section.tokens.map((token) => renderToken(token))}
                </div>
              ))}
            </div>

            {KIOSK_IMAGE_SECTIONS.map((section) => (
              <div key={section.title} className="flex flex-col gap-5">
                <span className="text-sm font-bold uppercase tracking-wider text-white/40">
                  {section.title}
                </span>
                {section.images.map((image) => {
                  const previewUrl = getKioskImageUrl(image.key);
                  const isOverridden = Boolean(imageOverrides[image.key]);

                  return (
                    <div key={image.key} className="flex items-center justify-between gap-6 text-xl">
                      <span className="min-w-[180px] text-white/80">{image.label}</span>
                      <div className="flex flex-1 items-center gap-4">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-14 w-14 rounded-xl border-2 border-white/15 bg-[#171a28] object-contain p-1"
                          />
                        ) : (
                          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/15 text-sm text-white/40">
                            —
                          </span>
                        )}
                        <label className="cursor-pointer rounded-xl border-2 border-white/15 bg-white/5 px-4 py-3 text-base font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/10">
                          Заменить
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              handleImagePick(image.key, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {isOverridden ? (
                          <span className="text-sm text-white/45">своё</span>
                        ) : image.optional ? (
                          <span className="text-sm text-white/45">по умолчанию</span>
                        ) : (
                          <span className="text-sm text-white/45">встроенное</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => resetKioskImage(image.key)}
                        className="shrink-0 rounded-full border-2 border-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-white/50 transition-colors hover:border-white/30 hover:text-white"
                      >
                        Сброс
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {SECTIONS.slice(2).map((section) => (
            <div key={section.title} className="flex flex-col gap-5">
              <span className="text-base font-bold uppercase tracking-wider text-white/50">
                {section.title}
              </span>
              {section.tokens.map((token) => renderToken(token))}
            </div>
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
