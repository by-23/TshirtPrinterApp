import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  POPULAR_SCROLL_CSS_VARS,
  syncAllPopularScrollElements,
} from "../editor/popularScrollTheme.js";
import { SlidersVertical } from "./icons.js";

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

const RADIUS_FULL: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 999,
  step: 1,
  unit: "px",
};

const GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 32,
  step: 1,
  unit: "px",
};

const FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 8,
  max: 48,
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

const BORDER_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 8,
  step: 0.5,
  unit: "px",
};

const SCROLL_SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 2,
  max: 16,
  step: 1,
  unit: "px",
};

const OPACITY_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 0,
  max: 1,
  step: 0.05,
};

const CONTENT_ALIGN_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = {
  type: "range",
  min: 0,
  max: 1,
  step: 1,
};

const BLOCK_HEIGHT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 800,
  step: 1,
  unit: "px",
};

const BLOCK_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 1600,
  step: 1,
  unit: "px",
};

const LAYOUT_GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 64,
  step: 1,
  unit: "px",
};

interface BlockBorderDefaults {
  width: number;
  color: string;
  opacity: number;
  radius: number;
  padding: number;
  height?: number;
  /** 0 = start (left), 1 = center */
  contentAlign?: number;
}

/** Border + rounding + padding row set for a page-level "block" wrapper — see `borderStyle.ts`. */
function blockBorderTokens(prefix: string, defaults: BlockBorderDefaults): Token[] {
  return [
    {
      key: `--editor-${prefix}-height`,
      label: "Высота блока (0 = авто)",
      defaultValue: defaults.height ?? 0,
      ...BLOCK_HEIGHT_RANGE,
    },
    { key: `--editor-${prefix}-border-width`, label: "Обводка — толщина", defaultValue: defaults.width, ...BORDER_WIDTH_RANGE },
    { key: `--editor-${prefix}-border-color`, label: "Обводка — цвет", type: "color", defaultValue: defaults.color },
    { key: `--editor-${prefix}-border-opacity`, label: "Обводка — прозрачность", defaultValue: defaults.opacity, ...OPACITY_RANGE },
    {
      key: `--editor-${prefix}-radius`,
      label: "Скругление блока",
      defaultValue: defaults.radius,
      type: "range",
      min: 0,
      max: 60,
      step: 1,
      unit: "px",
    },
    {
      key: `--editor-${prefix}-padding`,
      label: "Внутренний отступ",
      defaultValue: defaults.padding,
      type: "range",
      min: 0,
      max: 48,
      step: 1,
      unit: "px",
    },
    {
      key: `--editor-${prefix}-content-align`,
      label: "Содержимое — выравнивание (0 слева, 1 центр)",
      defaultValue: defaults.contentAlign ?? 0,
      ...CONTENT_ALIGN_RANGE,
    },
  ];
}

interface DividerDefaults {
  width: number;
  color: string;
  opacity: number;
}

/** Thin-rule row set for a divider between elements inside a block — see `borderStyle.ts`. */
function dividerTokens(prefix: string, defaults: DividerDefaults): Token[] {
  return [
    { key: `--editor-${prefix}-divider-width`, label: "Разделитель — толщина", defaultValue: defaults.width, ...BORDER_WIDTH_RANGE },
    { key: `--editor-${prefix}-divider-color`, label: "Разделитель — цвет", type: "color", defaultValue: defaults.color },
    { key: `--editor-${prefix}-divider-opacity`, label: "Разделитель — прозрачность", defaultValue: defaults.opacity, ...OPACITY_RANGE },
  ];
}

const BLOCK_BORDER_DEFAULT: Omit<BlockBorderDefaults, "radius" | "padding"> = {
  width: 1.5,
  color: "#242938",
  opacity: 1,
  contentAlign: 0,
};

const GARMENT_BLOCK_DEFAULT: BlockBorderDefaults = {
  ...BLOCK_BORDER_DEFAULT,
  radius: 16,
  padding: 16,
  contentAlign: 1,
};

const DIVIDER_DEFAULT_STRONG: DividerDefaults = { width: 1.5, color: "#242938", opacity: 0.8 };
const DIVIDER_DEFAULT_SUBTLE: DividerDefaults = { width: 1.5, color: "#242938", opacity: 0.6 };

/**
 * Every tunable editor-screen token, grouped the same way as the panel's UI.
 * Values here MUST match the defaults declared in `index.css` — this is the
 * single list the panel reads/writes, and what "Сброс" restores.
 */
const SECTIONS: Section[] = [
  {
    title: "Общий фон страницы",
    tokens: [{ key: "--editor-page-bg", label: "Фон страницы", type: "color", defaultValue: "#05060f" }],
  },
  {
    title: "Отступы между блоками",
    tokens: [
      { key: "--editor-page-section-gap", label: "Между секциями страницы", defaultValue: 32, ...LAYOUT_GAP_RANGE },
      { key: "--editor-main-columns-gap", label: "Между колонками (лево / центр / право)", defaultValue: 24, ...LAYOUT_GAP_RANGE },
      { key: "--editor-right-panel-gap", label: "В правой панели", defaultValue: 24, ...LAYOUT_GAP_RANGE },
      { key: "--editor-garment-blocks-gap", label: "Между цвет / размер / материал", defaultValue: 24, ...LAYOUT_GAP_RANGE },
      { key: "--editor-center-column-gap", label: "Между холстом и полоской управления", defaultValue: 16, ...LAYOUT_GAP_RANGE },
      { key: "--editor-price-section-gap", label: "Между цена / печать / сноска", defaultValue: 16, ...LAYOUT_GAP_RANGE },
    ],
  },
  {
    title: "Шапка",
    tokens: [
      { key: "--editor-header-title-size", label: "Заголовок — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--editor-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--editor-header-category-size", label: "Категория — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-header-category-color", label: "Категория — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-back-btn-width", label: "Кнопка «назад» — ширина", defaultValue: 96, ...SIZE_RANGE },
      { key: "--editor-back-btn-height", label: "Кнопка «назад» — высота", defaultValue: 40, ...SIZE_RANGE },
      { key: "--editor-back-btn-radius", label: "Кнопка «назад» — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-back-btn-bg", label: "Кнопка «назад» — фон", type: "color", defaultValue: "#131a2e" },
      {
        key: "--editor-back-btn-border-width",
        label: "Кнопка «назад» — обводка толщина",
        defaultValue: BLOCK_BORDER_DEFAULT.width,
        ...BORDER_WIDTH_RANGE,
      },
      {
        key: "--editor-back-btn-border-color",
        label: "Кнопка «назад» — обводка цвет",
        type: "color",
        defaultValue: BLOCK_BORDER_DEFAULT.color,
      },
      {
        key: "--editor-back-btn-border-opacity",
        label: "Кнопка «назад» — обводка прозрачность",
        defaultValue: BLOCK_BORDER_DEFAULT.opacity,
        ...OPACITY_RANGE,
      },
      ...dividerTokens("header", DIVIDER_DEFAULT_STRONG),
    ],
  },
  {
    title: "Переключатель стороны печати",
    tokens: [
      { key: "--editor-toggle-label-size", label: "Подпись — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-toggle-gap", label: "Зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--editor-toggle-btn-height", label: "Кнопки — высота", defaultValue: 44, ...SIZE_RANGE },
      { key: "--editor-toggle-pill-radius", label: "Скругление кнопок", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-toggle-font-size", label: "Текст кнопок — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--editor-toggle-active-bg", label: "Активная — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-toggle-idle-bg", label: "Неактивная — фон", type: "color", defaultValue: "#131a2e" },
    ],
  },
  {
    title: "Левая панель инструментов",
    tokens: [
      {
        key: "--editor-rail-width",
        label: "Ширина панели",
        defaultValue: 96,
        type: "range",
        min: 64,
        max: 220,
        step: 1,
        unit: "px",
      },
      { key: "--editor-rail-gap", label: "Зазор между кнопками", defaultValue: 12, ...GAP_RANGE },
      { key: "--editor-rail-btn-height", label: "Высота кнопки", defaultValue: 76, ...SIZE_RANGE },
      {
        key: "--editor-rail-btn-radius",
        label: "Скругление кнопок",
        defaultValue: 16,
        type: "range",
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
      },
      { key: "--editor-rail-icon-size", label: "Иконка — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--editor-rail-label-size", label: "Подпись — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--editor-rail-idle-bg", label: "Неактивная — фон", type: "color", defaultValue: "#131a2e" },
      { key: "--editor-rail-active-bg", label: "Активная — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-rail-idle-text", label: "Неактивная — текст", type: "color", defaultValue: "#a7b0d0" },
      ...blockBorderTokens("rail-block", { ...BLOCK_BORDER_DEFAULT, radius: 20, padding: 12 }),
      ...dividerTokens("rail", DIVIDER_DEFAULT_SUBTLE),
    ],
  },
  {
    title: "Карточка холста",
    tokens: [
      {
        key: "--editor-canvas-card-radius",
        label: "Скругление",
        defaultValue: 24,
        type: "range",
        min: 0,
        max: 60,
        step: 1,
        unit: "px",
      },
      {
        key: "--editor-canvas-card-width",
        label: "Ширина блока",
        defaultValue: 640,
        type: "range",
        min: 360,
        max: 820,
        step: 1,
        unit: "px",
      },
      {
        key: "--editor-canvas-card-height",
        label: "Высота блока",
        defaultValue: 720,
        type: "range",
        min: 420,
        max: 1600,
        step: 1,
        unit: "px",
      },
      { key: "--editor-canvas-card-bg", label: "Фон", type: "color", defaultValue: "#0b0f1e" },
      {
        key: "--editor-canvas-card-padding",
        label: "Внутренний отступ",
        defaultValue: 20,
        type: "range",
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
      },
      {
        key: "--editor-canvas-scale",
        label: "Масштаб макета",
        defaultValue: 1,
        type: "range",
        min: 0.7,
        max: 1.3,
        step: 0.02,
      },
    ],
  },
  {
    title: "Полоска управления объектом",
    tokens: [
      {
        key: "--editor-strip-radius",
        label: "Скругление",
        defaultValue: 16,
        type: "range",
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
      },
      { key: "--editor-strip-bg", label: "Фон", type: "color", defaultValue: "#0b0f1e" },
      { key: "--editor-strip-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#1b2440" },
      { key: "--editor-strip-border-width", label: "Обводка — толщина", defaultValue: 1.5, ...BORDER_WIDTH_RANGE },
      { key: "--editor-strip-border-opacity", label: "Обводка — прозрачность", defaultValue: 1, ...OPACITY_RANGE },
      { key: "--editor-strip-height", label: "Высота блока (0 = авто)", defaultValue: 0, ...BLOCK_HEIGHT_RANGE },
      {
        key: "--editor-strip-padding",
        label: "Внутренний отступ",
        defaultValue: 16,
        type: "range",
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
      },
      { key: "--editor-strip-btn-bg", label: "Кнопки +/− — фон", type: "color", defaultValue: "#131a2e" },
      { key: "--editor-strip-btn-width", label: "Кнопки +/− — ширина", defaultValue: 32, ...SIZE_RANGE },
      { key: "--editor-strip-btn-height", label: "Кнопки +/− — высота", defaultValue: 32, ...SIZE_RANGE },
      { key: "--editor-strip-btn-radius", label: "Кнопки +/− — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-strip-label-font-size", label: "Подпись — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--editor-strip-value-font-size", label: "Значение — размер", defaultValue: 16, ...FONT_RANGE },
    ],
  },
  {
    title: "Плавающие кнопки объекта",
    tokens: [
      { key: "--editor-objctrl-bar-radius", label: "Скругление панели", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-objctrl-btn-width", label: "Кнопки — ширина", defaultValue: 28, ...SIZE_RANGE },
      { key: "--editor-objctrl-btn-height", label: "Кнопки — высота", defaultValue: 28, ...SIZE_RANGE },
      { key: "--editor-objctrl-bg", label: "Кнопки — фон", type: "color", defaultValue: "#131a2e" },
      { key: "--editor-objctrl-delete-bg", label: "Удалить — фон", type: "color", defaultValue: "#dc2626" },
    ],
  },
  {
    title: "Правая панель",
    tokens: [
      {
        key: "--editor-right-panel-width",
        label: "Ширина панели",
        defaultValue: 288,
        type: "range",
        min: 200,
        max: 480,
        step: 1,
        unit: "px",
      },
    ],
  },
  {
    title: "Цвет изделия (плитки)",
    tokens: [
      { key: "--editor-swatch-width", label: "Плитка — ширина", defaultValue: 48, ...SIZE_RANGE },
      { key: "--editor-swatch-height", label: "Плитка — высота", defaultValue: 48, ...SIZE_RANGE },
      {
        key: "--editor-swatch-radius",
        label: "Скругление",
        defaultValue: 8,
        type: "range",
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
      },
      { key: "--editor-swatch-gap", label: "Зазор", defaultValue: 12, ...GAP_RANGE },
      ...blockBorderTokens("color-block", GARMENT_BLOCK_DEFAULT),
    ],
  },
  {
    title: "Размер (кнопки)",
    tokens: [
      { key: "--editor-size-pill-width", label: "Кнопки — ширина", defaultValue: 76, ...SIZE_RANGE },
      { key: "--editor-size-pill-height", label: "Кнопки — высота", defaultValue: 44, ...SIZE_RANGE },
      { key: "--editor-size-pill-radius", label: "Скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-size-pill-gap", label: "Зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--editor-size-pill-font-size", label: "Текст — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--editor-size-pill-active-bg", label: "Активная — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-size-pill-idle-bg", label: "Неактивная — фон", type: "color", defaultValue: "#131a2e" },
      ...blockBorderTokens("size-block", GARMENT_BLOCK_DEFAULT),
    ],
  },
  {
    title: "Материал (кнопки)",
    tokens: [
      { key: "--editor-fabric-pill-width", label: "Кнопки — ширина", defaultValue: 120, ...SIZE_RANGE },
      { key: "--editor-fabric-pill-height", label: "Кнопки — высота", defaultValue: 44, ...SIZE_RANGE },
      { key: "--editor-fabric-pill-radius", label: "Скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-fabric-pill-gap", label: "Зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--editor-fabric-pill-font-size", label: "Текст — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--editor-fabric-pill-active-bg", label: "Активная — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-fabric-pill-idle-bg", label: "Неактивная — фон", type: "color", defaultValue: "#131a2e" },
      ...blockBorderTokens("fabric-block", GARMENT_BLOCK_DEFAULT),
    ],
  },
  {
    title: "Кнопки «Предпросмотр» / «Полный экран»",
    tokens: [
      { key: "--editor-secondary-btn-height", label: "Высота кнопки", defaultValue: 48, ...SIZE_RANGE },
      { key: "--editor-secondary-btn-radius", label: "Скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-secondary-btn-gap", label: "Зазор между кнопками", defaultValue: 12, ...GAP_RANGE },
      { key: "--editor-secondary-btn-bg", label: "Фон", type: "color", defaultValue: "#131a2e" },
      { key: "--editor-secondary-btn-font-size", label: "Текст — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-secondary-btn-icon-size", label: "Иконка — размер", defaultValue: 18, ...FONT_RANGE },
      ...blockBorderTokens("secondary-block", { ...BLOCK_BORDER_DEFAULT, radius: 16, padding: 12 }),
      ...dividerTokens("secondary", DIVIDER_DEFAULT_SUBTLE),
    ],
  },
  {
    title: "Цена и печать",
    tokens: [
      { key: "--editor-price-label-size", label: "Подпись — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-price-amount-size", label: "Сумма — размер", defaultValue: 30, ...FONT_RANGE },
      { key: "--editor-price-color", label: "Сумма — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-price-leadtime-size", label: "Срок изготовления — размер текста", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-print-btn-height", label: "Кнопка печати — высота", defaultValue: 68, ...SIZE_RANGE },
      { key: "--editor-print-btn-radius", label: "Кнопка печати — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-print-btn-bg", label: "Кнопка печати — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--editor-print-btn-font-size", label: "Кнопка печати — текст", defaultValue: 18, ...FONT_RANGE },
      ...blockBorderTokens("price-block", { ...GARMENT_BLOCK_DEFAULT, padding: 16 }),
    ],
  },
  {
    title: "«Заказ сохраняется после оплаты» (сноска)",
    tokens: [
      { key: "--editor-ordernote-text-size", label: "Текст — размер", defaultValue: 12, ...FONT_RANGE },
      ...blockBorderTokens("ordernote-block", { ...BLOCK_BORDER_DEFAULT, radius: 12, padding: 12, contentAlign: 1 }),
    ],
  },
  {
    title: "Популярные элементы",
    tokens: [
      {
        key: "--editor-popular-block-width",
        label: "Ширина блока (0 = по содержимому)",
        defaultValue: 0,
        ...BLOCK_WIDTH_RANGE,
      },
      {
        key: "--editor-popular-tile-radius",
        label: "Плитка — скругление",
        defaultValue: 12,
        type: "range",
        min: 0,
        max: 56,
        step: 1,
        unit: "px",
      },
      { key: "--editor-popular-tile-bg", label: "Плитка — фон", type: "color", defaultValue: "#02060d" },
      { key: "--editor-popular-image-width", label: "Картинка — ширина", defaultValue: 167, ...SIZE_RANGE },
      { key: "--editor-popular-image-height", label: "Картинка — высота", defaultValue: 44, ...SIZE_RANGE },
      {
        key: "--editor-popular-image-gap",
        label: "Отступ между картинками",
        defaultValue: 16,
        ...LAYOUT_GAP_RANGE,
      },
      { key: "--editor-popular-scroll-size", label: "Скроллбар — толщина", defaultValue: 6, ...SCROLL_SIZE_RANGE },
      {
        key: "--editor-popular-scroll-track-color",
        label: "Скроллбар — дорожка, цвет",
        type: "color",
        defaultValue: "#242938",
      },
      {
        key: "--editor-popular-scroll-track-opacity",
        label: "Скроллбар — дорожка, прозрачность",
        defaultValue: 0.45,
        ...OPACITY_RANGE,
      },
      {
        key: "--editor-popular-scroll-thumb-color",
        label: "Скроллбар — ползунок, цвет",
        type: "color",
        defaultValue: "#5b6690",
      },
      {
        key: "--editor-popular-scroll-thumb-opacity",
        label: "Скроллбар — ползунок, прозрачность",
        defaultValue: 0.9,
        ...OPACITY_RANGE,
      },
      ...blockBorderTokens("popular-block", { ...BLOCK_BORDER_DEFAULT, radius: 16, padding: 16 }),
    ],
  },
  {
    title: "Советы",
    tokens: [
      {
        key: "--editor-tips-block-width",
        label: "Ширина блока (0 = по содержимому)",
        defaultValue: 0,
        ...BLOCK_WIDTH_RANGE,
      },
      { key: "--editor-tips-icon-width", label: "Иконка — ширина", defaultValue: 40, ...SIZE_RANGE },
      { key: "--editor-tips-icon-height", label: "Иконка — высота", defaultValue: 40, ...SIZE_RANGE },
      {
        key: "--editor-tips-icon-radius",
        label: "Иконка — скругление",
        defaultValue: 8,
        type: "range",
        min: 0,
        max: 40,
        step: 1,
        unit: "px",
      },
      { key: "--editor-tips-text-size", label: "Текст — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-tips-icon-bg", label: "Иконка — фон", type: "color", defaultValue: "#0b0f1e" },
      ...blockBorderTokens("tips-block", { ...BLOCK_BORDER_DEFAULT, radius: 16, padding: 16 }),
    ],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const STORAGE_KEY = "kiosk-editor-theme-overrides-v2";
const SCOPE_SELECTOR = ".editor-theme-root";

function normalizeValue(token: Token, value: string): string {
  if (token.type === "color") return value;
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) return String(token.defaultValue);
  const clamped = Math.min(token.max, Math.max(token.min, numeric));
  return String(clamped);
}

function formatCssValue(token: Token, value: string): string {
  const normalized = normalizeValue(token, value);
  if (token.key.endsWith("-height") && normalized === "0") return "auto";
  if (token.key.endsWith("-block-width") && normalized === "0") return "fit-content";
  if (token.key.endsWith("-content-align")) return normalized === "1" ? "center" : "start";
  return token.type === "range" && token.unit ? `${normalized}${token.unit}` : normalized;
}

function cssRawToState(token: Token, raw: string): string {
  if (token.key.endsWith("-height") && raw === "auto") return "0";
  if (token.key.endsWith("-block-width") && raw === "fit-content") return "0";
  if (token.key.endsWith("-content-align")) return raw === "center" ? "1" : "0";
  if (token.type === "range" && token.unit && raw.endsWith(token.unit)) {
    return raw.slice(0, -token.unit.length);
  }
  return raw;
}

function readTokenDefault(token: Token): string {
  if (typeof document === "undefined") return String(token.defaultValue);

  const raw = getComputedStyle(document.documentElement).getPropertyValue(token.key).trim();
  return raw ? cssRawToState(token, raw) : String(token.defaultValue);
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
    if (parsed["--editor-popular-tile-gap"] && !parsed["--editor-popular-image-gap"]) {
      parsed["--editor-popular-image-gap"] = parsed["--editor-popular-tile-gap"];
    }
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
  const editorRoot = document.querySelector(SCOPE_SELECTOR);
  if (editorRoot instanceof HTMLElement) {
    editorRoot.style.setProperty(key, cssValue);
    if (POPULAR_SCROLL_CSS_VARS.includes(key as (typeof POPULAR_SCROLL_CSS_VARS)[number])) {
      syncAllPopularScrollElements(editorRoot);
    }
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const editorRoot = document.querySelector(SCOPE_SELECTOR);
  if (editorRoot instanceof HTMLElement) {
    editorRoot.style.removeProperty(key);
    if (POPULAR_SCROLL_CSS_VARS.includes(key as (typeof POPULAR_SCROLL_CSS_VARS)[number])) {
      syncAllPopularScrollElements(editorRoot);
    }
  }
}

/**
 * Floating "design panel" for the editor screen — a sibling to the main
 * ThemePanel (kiosk home), but scoped to `/kiosk/editor` and to the sizes
 * (width/height tracked independently), roundings and colors of every block
 * there, each tunable on its own. Same mechanics as ThemePanel: reads and
 * writes the `--editor-*` CSS custom properties declared in `index.css`,
 * persists to localStorage, and «Сохранить по умолчанию» writes the current
 * values into `index.css` (dev server only). Every numeric token can be
 * dragged via its slider or typed directly into the adjoining number field.
 */
export function EditorThemePanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...getBaselineValues(),
    ...loadStoredValues(),
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isEditorRoute = location.pathname === "/kiosk/editor";

  useEffect(() => {
    function applyAll() {
      for (const [key, value] of Object.entries(values)) {
        applyValue(key, value);
      }
      const editorRoot = document.querySelector(SCOPE_SELECTOR);
      if (editorRoot instanceof HTMLElement) {
        syncAllPopularScrollElements(editorRoot);
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
    const editorRoot = document.querySelector(SCOPE_SELECTOR);
    if (editorRoot instanceof HTMLElement) {
      syncAllPopularScrollElements(editorRoot);
    }
  }, [open, values]);

  if (!isEditorRoute) return null;

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
    const defaults = readAllDefaults();
    setValues(defaults);
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
    <div className="fixed right-6 top-32 z-50 flex flex-col items-end gap-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки редактора"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <SlidersVertical aria-hidden className="h-10 w-10" strokeWidth={1.7} />
      </button>

      {open ? (
        <div className="settings-panel-scroll flex max-h-[80vh] w-[760px] flex-col gap-8 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold uppercase tracking-wide text-white/90">
              Настройки редактора
            </span>
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
