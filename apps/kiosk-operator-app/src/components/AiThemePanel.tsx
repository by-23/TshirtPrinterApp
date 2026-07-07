import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAiFlowStore } from "../lib/aiFlowStore.js";
import { GripVertical, Palette } from "./icons.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";

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
  options: { label: string; value: string }[];
}

type Token = ColorToken | RangeToken | SelectToken;

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

const CARD_HEIGHT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 180,
  max: 900,
  step: 1,
  unit: "px",
};

const CARD_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 280,
  max: 1080,
  step: 1,
  unit: "px",
};

const ICON_SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 32,
  max: 400,
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

const SCALE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 0.9,
  max: 1,
  step: 0.01,
};

const GLOW_SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 80,
  step: 1,
  unit: "px",
};

const GLOW_SPREAD_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: -40,
  max: 40,
  step: 1,
  unit: "px",
};

const GRADIENT_DIRECTION_OPTIONS = [
  { label: "Сверху вниз", value: "to bottom" },
  { label: "Снизу вверх", value: "to top" },
  { label: "Слева направо", value: "to right" },
  { label: "Справа налево", value: "to left" },
  { label: "Вниз вправо", value: "to bottom right" },
  { label: "Вниз влево", value: "to bottom left" },
  { label: "Вверх вправо", value: "to top right" },
  { label: "Вверх влево", value: "to top left" },
] as const;

const GRADIENT_DIRECTION: Pick<SelectToken, "type" | "options"> = {
  type: "select",
  options: [...GRADIENT_DIRECTION_OPTIONS],
};

/**
 * Every tunable AI source-select token. Values MUST match defaults in `index.css`.
 */
const SECTIONS: Section[] = [
  {
    title: "Страница",
    tokens: [{ key: "--ai-page-bg", label: "Фон страницы", type: "color", defaultValue: "#000000" }],
  },
  {
    title: "Шапка",
    tokens: [
      { key: "--ai-header-padding-x", label: "Отступы по бокам", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-header-padding-y", label: "Отступы сверху/снизу", defaultValue: 16, ...PADDING_RANGE },
    ],
  },
  {
    title: "Кнопка «Назад»",
    tokens: [
      { key: "--ai-back-btn-radius", label: "Скругление", defaultValue: 14, ...RADIUS_RANGE },
      { key: "--ai-back-btn-border-width", label: "Обводка — толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-back-btn-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-back-btn-border-opacity", label: "Обводка — прозрачность", defaultValue: 0.18, ...OPACITY_RANGE },
      { key: "--ai-back-btn-padding-x", label: "Внутр. отступ — горизонт.", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-back-btn-padding-y", label: "Внутр. отступ — вертик.", defaultValue: 8, ...PADDING_RANGE },
      { key: "--ai-back-btn-gap", label: "Зазор иконка/текст", defaultValue: 8, ...GAP_RANGE },
      { key: "--ai-back-btn-icon-size", label: "Иконка — размер", defaultValue: 20, ...SIZE_RANGE },
      { key: "--ai-back-btn-title-size", label: "«Назад» — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--ai-back-btn-title-color", label: "«Назад» — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-back-btn-subtitle-size", label: "Подпись — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--ai-back-btn-subtitle-color", label: "Подпись — цвет", type: "color", defaultValue: "#cac9cb" },
    ],
  },
  {
    title: "Заголовок экрана",
    tokens: [
      { key: "--ai-source-screen-padding-x", label: "Отступы по бокам", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-source-screen-padding-top", label: "Отступ сверху", defaultValue: 8, ...PADDING_RANGE },
      { key: "--ai-source-screen-padding-bottom", label: "Отступ снизу", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-source-header-padding-top", label: "Заголовок — отступ сверху", defaultValue: 4, ...PADDING_RANGE },
      { key: "--ai-source-header-title-size", label: "Заголовок — размер", defaultValue: 28, ...FONT_RANGE },
      { key: "--ai-source-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-source-header-subtitle-size", label: "Подзаголовок — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--ai-source-header-subtitle-color", label: "Подзаголовок — цвет", type: "color", defaultValue: "#a7b0d0" },
      {
        key: "--ai-source-header-subtitle-margin-top",
        label: "Подзаголовок — отступ сверху",
        defaultValue: 6,
        ...GAP_RANGE,
      },
    ],
  },
  {
    title: "Сетка карточек",
    tokens: [
      { key: "--ai-source-cards-gap", label: "Зазор между карточками", defaultValue: 20, ...GAP_RANGE },
      { key: "--ai-source-cards-padding-y", label: "Отступы сверху/снизу", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-source-card-width", label: "Ширина карточки", defaultValue: 1040, ...CARD_WIDTH_RANGE },
      { key: "--ai-source-card-height", label: "Высота карточки", defaultValue: 420, ...CARD_HEIGHT_RANGE },
      { key: "--ai-source-card-gap", label: "Зазор внутри карточки", defaultValue: 14, ...GAP_RANGE },
      { key: "--ai-source-card-padding-x", label: "Внутр. отступ — горизонт.", defaultValue: 28, ...PADDING_RANGE },
      { key: "--ai-source-card-padding-top", label: "Внутр. отступ — сверху", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-source-card-padding-bottom", label: "Внутр. отступ — снизу", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-source-card-radius", label: "Скругление", defaultValue: 24, ...RADIUS_RANGE },
      { key: "--ai-source-card-border-width", label: "Рамка — толщина", defaultValue: 2, ...BORDER_WIDTH_RANGE },
      { key: "--ai-source-card-active-scale", label: "Сжатие при нажатии", defaultValue: 0.98, ...SCALE_RANGE },
      { key: "--ai-source-card-title-size", label: "Заголовок карточки — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--ai-source-card-subtitle-size", label: "Подпись карточки — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--ai-source-card-subtitle-color", label: "Подпись карточки — цвет", type: "color", defaultValue: "#a7b0d0" },
    ],
  },
  {
    title: "Карточка «Камера» — фон и рамка",
    tokens: [
      {
        key: "--ai-source-camera-bg-direction",
        label: "Фон — направление",
        defaultValue: "to bottom",
        ...GRADIENT_DIRECTION,
      },
      { key: "--ai-source-camera-bg-start", label: "Фон — верх", type: "color", defaultValue: "#1a0828" },
      { key: "--ai-source-camera-bg-middle", label: "Фон — середина", type: "color", defaultValue: "#0d0418" },
      { key: "--ai-source-camera-bg-end", label: "Фон — низ", type: "color", defaultValue: "#08030f" },
      {
        key: "--ai-source-camera-border-direction",
        label: "Рамка — направление",
        defaultValue: "to bottom right",
        ...GRADIENT_DIRECTION,
      },
      { key: "--ai-source-camera-border-start", label: "Рамка — начало", type: "color", defaultValue: "#8b5cf6" },
      { key: "--ai-source-camera-border-middle", label: "Рамка — середина", type: "color", defaultValue: "#c026d3" },
      { key: "--ai-source-camera-border-end", label: "Рамка — конец", type: "color", defaultValue: "#ff2d95" },
    ],
  },
  {
    title: "Карточка «Камера» — акценты",
    tokens: [
      { key: "--ai-source-camera-glow-size", label: "Свечение — размер", defaultValue: 28, ...GLOW_SIZE_RANGE },
      { key: "--ai-source-camera-glow-spread", label: "Свечение — spread", defaultValue: -8, ...GLOW_SPREAD_RANGE },
      { key: "--ai-source-camera-glow-color", label: "Свечение — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-source-camera-glow-opacity", label: "Свечение — прозрачность", defaultValue: 0.5, ...OPACITY_RANGE },
      { key: "--ai-source-camera-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-source-camera-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#ff2d95" },
    ],
  },
  {
    title: "Карточка «Телефон» — фон и рамка",
    tokens: [
      {
        key: "--ai-source-phone-bg-direction",
        label: "Фон — направление",
        defaultValue: "to bottom",
        ...GRADIENT_DIRECTION,
      },
      { key: "--ai-source-phone-bg-start", label: "Фон — верх", type: "color", defaultValue: "#081828" },
      { key: "--ai-source-phone-bg-middle", label: "Фон — середина", type: "color", defaultValue: "#040d18" },
      { key: "--ai-source-phone-bg-end", label: "Фон — низ", type: "color", defaultValue: "#030810" },
      {
        key: "--ai-source-phone-border-direction",
        label: "Рамка — направление",
        defaultValue: "to bottom right",
        ...GRADIENT_DIRECTION,
      },
      { key: "--ai-source-phone-border-start", label: "Рамка — начало", type: "color", defaultValue: "#1d4ed8" },
      { key: "--ai-source-phone-border-middle", label: "Рамка — середина", type: "color", defaultValue: "#0891b2" },
      { key: "--ai-source-phone-border-end", label: "Рамка — конец", type: "color", defaultValue: "#22d3f5" },
    ],
  },
  {
    title: "Карточка «Телефон» — акценты",
    tokens: [
      { key: "--ai-source-phone-glow-size", label: "Свечение — размер", defaultValue: 28, ...GLOW_SIZE_RANGE },
      { key: "--ai-source-phone-glow-spread", label: "Свечение — spread", defaultValue: -8, ...GLOW_SPREAD_RANGE },
      { key: "--ai-source-phone-glow-color", label: "Свечение — цвет", type: "color", defaultValue: "#22d3f5" },
      { key: "--ai-source-phone-glow-opacity", label: "Свечение — прозрачность", defaultValue: 0.42, ...OPACITY_RANGE },
      { key: "--ai-source-phone-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#22d3f5" },
      { key: "--ai-source-phone-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#22d3f5" },
    ],
  },
  {
    title: "Иконки карточек",
    tokens: [
      { key: "--ai-source-icon-size", label: "Размер иконки", defaultValue: 96, ...ICON_SIZE_RANGE },
      { key: "--ai-source-icon-wrap-min-height", label: "Мин. высота зоны иконки", defaultValue: 120, ...SIZE_RANGE },
    ],
  },
  {
    title: "Бейдж AI",
    tokens: [
      { key: "--ai-source-badge-top", label: "Отступ сверху", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-source-badge-right", label: "Отступ справа", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-source-badge-size", label: "Размер", defaultValue: 24, ...SIZE_RANGE },
      { key: "--ai-source-badge-bg", label: "Фон", type: "color", defaultValue: "#e11d48" },
      { key: "--ai-source-badge-font-size", label: "Текст — размер", defaultValue: 8, ...FONT_RANGE },
      { key: "--ai-source-badge-color", label: "Текст — цвет", type: "color", defaultValue: "#ffffff" },
    ],
  },
  {
    title: "Инфо-бар",
    tokens: [
      { key: "--ai-source-info-gap", label: "Зазор иконка/текст", defaultValue: 10, ...GAP_RANGE },
      { key: "--ai-source-info-padding-x", label: "Отступы по бокам", defaultValue: 14, ...PADDING_RANGE },
      { key: "--ai-source-info-padding-y", label: "Отступы сверху/снизу", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-source-info-radius", label: "Скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--ai-source-info-border-width", label: "Обводка — толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-source-info-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-source-info-border-opacity", label: "Обводка — прозрачность", defaultValue: 0.1, ...OPACITY_RANGE },
      { key: "--ai-source-info-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#0b0f1e" },
      { key: "--ai-source-info-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.65, ...OPACITY_RANGE },
      { key: "--ai-source-info-font-size", label: "Текст — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--ai-source-info-text-color", label: "Текст — цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-source-info-icon-size", label: "Иконка «i» — размер", defaultValue: 18, ...SIZE_RANGE },
      { key: "--ai-source-info-icon-font-size", label: "Иконка «i» — шрифт", defaultValue: 10, ...FONT_RANGE },
      { key: "--ai-source-info-icon-border-width", label: "Иконка — обводка толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-source-info-icon-border-color", label: "Иконка — обводка цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-source-info-icon-border-opacity", label: "Иконка — обводка прозрачность", defaultValue: 0.35, ...OPACITY_RANGE },
      { key: "--ai-source-info-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-source-info-icon-color-opacity", label: "Иконка — прозрачность", defaultValue: 0.75, ...OPACITY_RANGE },
    ],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const STORAGE_KEY = "kiosk-ai-source-theme-overrides-v1";
const SCOPE_SELECTOR = ".ai-theme-root";

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
  if (token.type === "range" && token.unit) {
    return `${normalized}${token.unit}`;
  }
  return normalized;
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
  const aiRoot = document.querySelector(SCOPE_SELECTOR);
  if (aiRoot instanceof HTMLElement) {
    aiRoot.style.setProperty(key, cssValue);
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const aiRoot = document.querySelector(SCOPE_SELECTOR);
  if (aiRoot instanceof HTMLElement) {
    aiRoot.style.removeProperty(key);
  }
}

/**
 * Floating design panel for `/kiosk/ai` step "source" (ИИ-стиль — выбор фото).
 */
export function AiThemePanel() {
  const location = useLocation();
  const step = useAiFlowStore((state) => state.step);
  const [open, setOpen] = useState(false);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("ai-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...getBaselineValues(),
    ...loadStoredValues(),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isAiSourceScreen = location.pathname === "/kiosk/ai" && step === "source";

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

  if (!isAiSourceScreen) return null;

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
        ) : token.type === "select" ? (
          <select
            value={values[token.key] ?? token.defaultValue}
            onChange={(e) => handleChange(token.key, e.target.value)}
            className="min-w-[260px] rounded-xl border-2 border-white/15 bg-[#171a28] px-4 py-3 text-lg text-white outline-none transition-colors hover:border-white/30 focus:border-white/40"
          >
            {token.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
    <div ref={containerRef} className="fixed right-6 top-[31.5rem] z-50 flex flex-col items-end gap-5" style={dragStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки экрана ИИ-стиль"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <Palette aria-hidden className="h-10 w-10" strokeWidth={1.7} />
      </button>

      {open ? (
        <div className="settings-panel-scroll flex max-h-[80vh] w-[760px] flex-col gap-8 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
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
              <span className="text-2xl font-bold uppercase tracking-wide text-white/90">Настройки ИИ-стиль</span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border-2 border-white/15 px-5 py-2.5 text-base font-semibold uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Сброс
            </button>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-5">
              <span className="text-base font-bold uppercase tracking-wider text-white/50">{section.title}</span>
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
