import { useEffect, useId, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  CHECKOUT_IMAGE_DEFINITIONS,
  getKioskImageUrl,
  resetKioskImage,
  setKioskImageOverride,
  useKioskImageOverrides,
  type KioskImageDefinition,
} from "../lib/kioskImages.js";
import { GripVertical, SlidersHorizontal } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  settingsSectionId,
} from "./settingsPanelUi.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";
import { THEME_PANEL_CHROME_ATTR } from "../lib/themePick.js";
import { useDesignPanelPick } from "../lib/useDesignPanelPick.js";

import {
  clearThemeOverrideStorage,
  createThemeCssSaver,
  overlayThemeRuntimeOverrides,
  themeSaveStatusLabel,
  type ThemeSaveState,
} from "../lib/themeCssSave.js";

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

const GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 32,
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

const FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 8,
  max: 48,
  step: 1,
  unit: "px",
};

const ORDER_NUMBER_FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 16,
  max: 120,
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

const SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 16,
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

const RADIUS_FULL: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 999,
  step: 1,
  unit: "px",
};

const PADDING_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 64,
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

const PREVIEW_BLOCK_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 280,
  max: 800,
  step: 1,
  unit: "px",
};

const PREVIEW_BLOCK_HEIGHT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 320,
  max: 800,
  step: 1,
  unit: "px",
};

const PREVIEW_MOCKUP_HEIGHT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 180,
  max: 640,
  step: 1,
  unit: "px",
};

const BLOCK_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 800,
  step: 1,
  unit: "px",
};

interface BlockBorderDefaults {
  width: number;
  color: string;
  opacity: number;
  radius: number;
  padding: number;
  contentAlign?: "start" | "center";
}

const BLOCK_BORDER_DEFAULT: Omit<BlockBorderDefaults, "radius" | "padding"> = {
  width: 1.5,
  color: "#242938",
  opacity: 1,
  contentAlign: "start",
};

/** Border + rounding + padding row set for a checkout "block" wrapper — see `checkout/borderStyle.ts`. */
function blockBorderTokens(prefix: string, defaults: BlockBorderDefaults): Token[] {
  return [
    { key: `--checkout-${prefix}-border-width`, label: "Обводка — толщина", defaultValue: defaults.width, ...BORDER_WIDTH_RANGE },
    { key: `--checkout-${prefix}-border-color`, label: "Обводка — цвет", type: "color", defaultValue: defaults.color },
    { key: `--checkout-${prefix}-border-opacity`, label: "Обводка — прозрачность", defaultValue: defaults.opacity, ...OPACITY_RANGE },
    { key: `--checkout-${prefix}-radius`, label: "Скругление блока", defaultValue: defaults.radius, ...RADIUS_RANGE },
    { key: `--checkout-${prefix}-padding`, label: "Внутренний отступ", defaultValue: defaults.padding, ...PADDING_RANGE },
  ];
}

interface DividerDefaults {
  width: number;
  color: string;
  opacity: number;
}

const DIVIDER_DEFAULT: DividerDefaults = { width: 1.5, color: "#242938", opacity: 0.8 };

function dividerTokens(prefix: string, defaults: DividerDefaults): Token[] {
  return [
    { key: `--checkout-${prefix}-divider-width`, label: "Разделитель — толщина", defaultValue: defaults.width, ...BORDER_WIDTH_RANGE },
    { key: `--checkout-${prefix}-divider-color`, label: "Разделитель — цвет", type: "color", defaultValue: defaults.color },
    { key: `--checkout-${prefix}-divider-opacity`, label: "Разделитель — прозрачность", defaultValue: defaults.opacity, ...OPACITY_RANGE },
  ];
}

/**
 * Every tunable checkout-screen token, grouped the same way as the panel's
 * UI and matching the order the blocks appear on `checkout.png`. Values here
 * MUST match the defaults declared in `index.css` — this is the single list
 * the panel reads/writes, and what "Сброс" restores.
 */
const SECTIONS: Section[] = [
  {
    title: "Отступы между блоками",
    tokens: [
      { key: "--checkout-page-section-gap", label: "Между секциями страницы", defaultValue: 28, ...LAYOUT_GAP_RANGE },
      { key: "--checkout-main-columns-gap", label: "Между превью и сводкой", defaultValue: 24, ...LAYOUT_GAP_RANGE },
      { key: "--checkout-preview-column-width", label: "Ширина колонки превью", defaultValue: 380, ...BLOCK_WIDTH_RANGE },
      { key: "--checkout-payment-section-gap", label: "В блоке способов оплаты", defaultValue: 20, ...LAYOUT_GAP_RANGE },
      { key: "--checkout-footer-gap", label: "Между кнопками футера", defaultValue: 16, ...LAYOUT_GAP_RANGE },
    ],
  },
  {
    title: "Шапка",
    tokens: [
      { key: "--checkout-header-title-size", label: "Заголовок — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--checkout-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-header-subtitle-size", label: "Подзаголовок — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--checkout-header-subtitle-color", label: "Подзаголовок — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--checkout-back-btn-width", label: "Кнопка «назад» — ширина", defaultValue: 150, ...SIZE_RANGE },
      { key: "--checkout-back-btn-height", label: "Кнопка «назад» — высота", defaultValue: 52, ...SIZE_RANGE },
      { key: "--checkout-back-btn-radius", label: "Кнопка «назад» — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--checkout-back-btn-bg", label: "Кнопка «назад» — фон", type: "color", defaultValue: "#131a2e" },
      { key: "--checkout-back-btn-border-width", label: "Кнопка «назад» — обводка толщина", defaultValue: BLOCK_BORDER_DEFAULT.width, ...BORDER_WIDTH_RANGE },
      { key: "--checkout-back-btn-border-color", label: "Кнопка «назад» — обводка цвет", type: "color", defaultValue: BLOCK_BORDER_DEFAULT.color },
      { key: "--checkout-back-btn-border-opacity", label: "Кнопка «назад» — обводка прозрачность", defaultValue: BLOCK_BORDER_DEFAULT.opacity, ...OPACITY_RANGE },
      ...dividerTokens("header", DIVIDER_DEFAULT),
    ],
  },
  {
    title: "Превью дизайна (левая колонка)",
    tokens: [
      { key: "--checkout-preview-gap", label: "Зазор мокап/переключатель", defaultValue: 20, ...GAP_RANGE },
      { key: "--checkout-preview-card-width", label: "Блок — ширина", defaultValue: 400, ...PREVIEW_BLOCK_WIDTH_RANGE },
      { key: "--checkout-preview-card-height", label: "Блок — высота", defaultValue: 520, ...PREVIEW_BLOCK_HEIGHT_RANGE },
      {
        key: "--checkout-preview-mockup-area-height",
        label: "Зона мокапа — высота",
        defaultValue: 360,
        ...PREVIEW_MOCKUP_HEIGHT_RANGE,
      },
      { key: "--checkout-preview-card-bg", label: "Блок — фон", type: "color", defaultValue: "#0b0f1e" },
      { key: "--checkout-preview-scale", label: "Масштаб мокапа", defaultValue: 0.5, type: "range", min: 0.35, max: 1, step: 0.05 },
      ...blockBorderTokens("preview-card", { ...BLOCK_BORDER_DEFAULT, radius: 24, padding: 16, contentAlign: "center" }),
      { key: "--checkout-preview-toggle-gap", label: "Переключатель — зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--checkout-preview-toggle-height", label: "Переключатель — высота", defaultValue: 44, ...SIZE_RANGE },
      { key: "--checkout-preview-toggle-radius", label: "Переключатель — скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--checkout-preview-toggle-font-size", label: "Переключатель — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--checkout-preview-toggle-active-bg", label: "Переключатель — активная", type: "color", defaultValue: "#ff2d95" },
      { key: "--checkout-preview-toggle-idle-bg", label: "Переключатель — неактивная", type: "color", defaultValue: "#131a2e" },
    ],
  },
  {
    title: "Сводка заказа (ВАШ ЗАКАЗ)",
    tokens: [
      { key: "--checkout-summary-section-gap", label: "Зазор между секциями", defaultValue: 12, ...GAP_RANGE },
      { key: "--checkout-summary-title-size", label: "Заголовок — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--checkout-summary-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#dd366f" },
      { key: "--checkout-summary-row-gap", label: "Между строками", defaultValue: 18, ...GAP_RANGE },
      { key: "--checkout-summary-row-icon-gap", label: "Строка — зазор иконка/текст", defaultValue: 14, ...GAP_RANGE },
      { key: "--checkout-summary-row-icon-size", label: "Строка — размер иконки", defaultValue: 28, ...FONT_RANGE },
      { key: "--checkout-summary-row-label-size", label: "Строка — название", defaultValue: 20, ...FONT_RANGE },
      { key: "--checkout-summary-row-label-color", label: "Строка — цвет названия", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-summary-row-detail-size", label: "Строка — описание", defaultValue: 15, ...FONT_RANGE },
      { key: "--checkout-summary-row-detail-color", label: "Строка — цвет описания", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-summary-row-icon-color", label: "Строка — цвет иконки", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-summary-row-amount-size", label: "Строка — сумма", defaultValue: 22, ...FONT_RANGE },
      { key: "--checkout-summary-row-amount-color", label: "Строка — цвет суммы (одежда)", type: "color", defaultValue: "#de366f" },
      { key: "--checkout-summary-row-surcharge-color", label: "Строка — цвет суммы (доплаты)", type: "color", defaultValue: "#de366f" },
      { key: "--checkout-summary-total-label-size", label: "Итого — текст", defaultValue: 24, ...FONT_RANGE },
      { key: "--checkout-summary-total-label-color", label: "Итого — цвет текста", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-summary-total-amount-size", label: "Итого — сумма", defaultValue: 40, ...FONT_RANGE },
      { key: "--checkout-summary-total-color", label: "Итого — цвет суммы", type: "color", defaultValue: "#de366f" },
      { key: "--checkout-summary-leadtime-size", label: "Срок изготовления — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--checkout-summary-leadtime-icon-size", label: "Срок изготовления — иконка", defaultValue: 20, ...FONT_RANGE },
      { key: "--checkout-summary-leadtime-width", label: "Срок изготовления — ширина", defaultValue: 360, ...BLOCK_WIDTH_RANGE },
      { key: "--checkout-summary-leadtime-color", label: "Срок изготовления — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--checkout-summary-leadtime-gap", label: "Срок изготовления — зазор", defaultValue: 8, ...GAP_RANGE },
      ...blockBorderTokens("summary-block", { ...BLOCK_BORDER_DEFAULT, radius: 20, padding: 20 }),
      ...dividerTokens("summary", DIVIDER_DEFAULT),
    ],
  },
  {
    title: "Способ оплаты — заголовок",
    tokens: [
      { key: "--checkout-payment-title-size", label: "Заголовок «СПОСОБ ОПЛАТЫ»", defaultValue: 20, ...FONT_RANGE },
    ],
  },
  {
    title: "Карточка «Оплата в кассу»",
    tokens: [
      {
        key: "--checkout-cash-card-bg-direction",
        label: "Фон — направление",
        type: "select",
        defaultValue: "to bottom",
        options: [...GRADIENT_DIRECTION_OPTIONS],
      },
      { key: "--checkout-cash-card-bg-start", label: "Фон — верх", type: "color", defaultValue: "#0d1a3a" },
      { key: "--checkout-cash-card-bg-end", label: "Фон — низ", type: "color", defaultValue: "#05060f" },
      { key: "--checkout-cash-card-gap", label: "Зазор между элементами", defaultValue: 12, ...GAP_RANGE },
      { key: "--checkout-cash-card-width", label: "Ширина карточки", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      { key: "--checkout-cash-title-size", label: "Заголовок — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--checkout-cash-subtitle-size", label: "Подпись — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--checkout-cash-subtitle-width", label: "Подпись — ширина", defaultValue: 300, ...BLOCK_WIDTH_RANGE },
      { key: "--checkout-cash-number-size", label: "Номер заказа — размер", defaultValue: 40, ...ORDER_NUMBER_FONT_RANGE },
      { key: "--checkout-cash-number-color", label: "Номер заказа — цвет", type: "color", defaultValue: "#ffffff" },
      {
        key: "--checkout-cash-number-box-border-width",
        label: "Рамка номера — толщина",
        defaultValue: 1.5,
        ...BORDER_WIDTH_RANGE,
      },
      {
        key: "--checkout-cash-number-box-border-color",
        label: "Рамка номера — цвет",
        type: "color",
        defaultValue: "#5b6b9a",
      },
      {
        key: "--checkout-cash-number-box-border-opacity",
        label: "Рамка номера — прозрачность",
        defaultValue: 0.75,
        ...OPACITY_RANGE,
      },
      {
        key: "--checkout-cash-number-box-radius",
        label: "Рамка номера — скругление",
        defaultValue: 16,
        ...RADIUS_RANGE,
      },
      {
        key: "--checkout-cash-number-box-padding-x",
        label: "Рамка номера — отступ X",
        defaultValue: 32,
        ...PADDING_RANGE,
      },
      {
        key: "--checkout-cash-number-box-padding-y",
        label: "Рамка номера — отступ Y",
        defaultValue: 16,
        ...PADDING_RANGE,
      },
      {
        key: "--checkout-cash-number-box-gap",
        label: "Рамка номера — зазор внутри",
        defaultValue: 8,
        ...GAP_RANGE,
      },
      {
        key: "--checkout-cash-number-box-bg",
        label: "Рамка номера — фон",
        type: "color",
        defaultValue: "#131a2e",
      },
      { key: "--checkout-cash-note-size", label: "Сноска — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--checkout-cash-note-width", label: "Сноска — ширина", defaultValue: 280, ...BLOCK_WIDTH_RANGE },
      { key: "--checkout-cash-icon-size", label: "Иконка кассы — размер", defaultValue: 120, ...SIZE_RANGE },
      { key: "--checkout-cash-icon-color", label: "Иконка кассы — цвет", type: "color", defaultValue: "#de3770" },
      { key: "--checkout-cash-image-width", label: "Картинка — ширина", defaultValue: 260, ...SIZE_RANGE },
      { key: "--checkout-cash-image-height", label: "Картинка — высота", defaultValue: 120, ...SIZE_RANGE },
      ...blockBorderTokens("cash-card", { width: 1.5, color: "#3b82f6", opacity: 0.55, radius: 20, padding: 24, contentAlign: "center" }),
    ],
  },
  {
    title: "Инфо-бар",
    tokens: [
      { key: "--checkout-info-bar-font-size", label: "Текст — размер", defaultValue: 13, ...FONT_RANGE },
      ...blockBorderTokens("info-bar", { ...BLOCK_BORDER_DEFAULT, radius: 16, padding: 14, contentAlign: "center" }),
    ],
  },
  {
    title: "Футер — «Нужна помощь?»",
    tokens: [
      { key: "--checkout-footer-help-bg", label: "Фон", type: "color", defaultValue: "#131a2e" },
      { key: "--checkout-footer-help-gap", label: "Зазор с иконкой", defaultValue: 10, ...GAP_RANGE },
      { key: "--checkout-footer-help-icon-size", label: "Иконка — размер", defaultValue: 24, ...SIZE_RANGE },
      { key: "--checkout-footer-help-title-size", label: "Заголовок — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--checkout-footer-help-subtitle-size", label: "Подпись — размер", defaultValue: 13, ...FONT_RANGE },
      ...blockBorderTokens("footer-help", { ...BLOCK_BORDER_DEFAULT, radius: 20, padding: 18, contentAlign: "center" }),
    ],
  },
  {
    title: "Футер — «Поделись результатом»",
    tokens: [
      { key: "--checkout-footer-promo-bg", label: "Фон", type: "color", defaultValue: "#2a0f3d" },
      { key: "--checkout-footer-promo-gap", label: "Зазор между элементами", defaultValue: 12, ...GAP_RANGE },
      { key: "--checkout-footer-promo-icon-size", label: "Иконка подарка — размер", defaultValue: 28, ...SIZE_RANGE },
      { key: "--checkout-footer-promo-icon-color", label: "Иконка подарка — цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--checkout-footer-promo-title-size", label: "Заголовок — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--checkout-footer-promo-subtitle-size", label: "Подпись — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--checkout-footer-promo-qr-radius", label: "QR — скругление", defaultValue: 8, ...RADIUS_RANGE },
      ...blockBorderTokens("footer-promo", { width: 1.5, color: "#ff2d95", opacity: 0.4, radius: 20, padding: 18, contentAlign: "start" }),
    ],
  },
  {
    title: "Плашка «Заказ принят»",
    tokens: [
      { key: "--checkout-accepted-bg", label: "Фон", type: "color", defaultValue: "#0b0f1e" },
      { key: "--checkout-accepted-gap", label: "Зазор между элементами", defaultValue: 16, ...GAP_RANGE },
      { key: "--checkout-accepted-padding", label: "Внутренний отступ", defaultValue: 48, ...PADDING_RANGE },
      { key: "--checkout-accepted-radius", label: "Скругление", defaultValue: 28, ...RADIUS_RANGE },
      { key: "--checkout-accepted-icon-size", label: "Иконка — размер", defaultValue: 64, ...SIZE_RANGE },
      { key: "--checkout-accepted-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#22c55e" },
      { key: "--checkout-accepted-title-size", label: "Заголовок — размер", defaultValue: 28, ...FONT_RANGE },
      { key: "--checkout-accepted-subtitle-size", label: "Подпись — размер", defaultValue: 16, ...FONT_RANGE },
    ],
  },
];

const PANEL_GROUPS: Array<{ label: string; titles: readonly string[] }> = [
  {
    label: "Основные",
    titles: ["Отступы между блоками", "Шапка"],
  },
  {
    label: "Заказ",
    titles: ["Превью дизайна (левая колонка)", "Сводка заказа (ВАШ ЗАКАЗ)"],
  },
  {
    label: "Оплата",
    titles: [
      "Способ оплаты — заголовок",
      "Карточка «Оплата в кассу»",
    ],
  },
  {
    label: "Низ экрана",
    titles: [
      "Инфо-бар",
      "Футер — «Нужна помощь?»",
      "Футер — «Поделись результатом»",
      "Плашка «Заказ принят»",
    ],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const SCOPE_SELECTOR = ".checkout-theme-root";
/** Removed when gradients were split into direction + stops — stale inline values block rendering. */
const DEPRECATED_TOKEN_KEYS = ["--checkout-qr-card-bg", "--checkout-cash-card-bg"];

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
  if (typeof document === "undefined") return overlayThemeRuntimeOverrides(values, ALL_TOKENS);
  return overlayThemeRuntimeOverrides(readAllDefaults(), ALL_TOKENS);
}


function hardcodedDefaults(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const token of ALL_TOKENS) {
    values[token.key] = String(token.defaultValue);
  }
  return values;
}

function tokensForCss(values: Record<string, string>): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const token of ALL_TOKENS) {
    tokens[token.key] = formatCssValue(token, values[token.key] ?? String(token.defaultValue));
  }
  return tokens;
}


function applyValue(key: string, value: string) {
  const token = TOKEN_BY_KEY.get(key);
  if (!token) return;
  const cssValue = formatCssValue(token, value);
  document.documentElement.style.setProperty(key, cssValue);
  const checkoutRoot = document.querySelector(SCOPE_SELECTOR);
  if (checkoutRoot instanceof HTMLElement) {
    checkoutRoot.style.setProperty(key, cssValue);
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const checkoutRoot = document.querySelector(SCOPE_SELECTOR);
  if (checkoutRoot instanceof HTMLElement) {
    checkoutRoot.style.removeProperty(key);
  }
}

/**
 * Floating design panel — every change writes CSS tokens into index.css (dev only).
 */
export function CheckoutThemePanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("checkout-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => getBaselineValues());
  const [saveState, setSaveState] = useState<ThemeSaveState>("idle");
  const saverRef = useRef(createThemeCssSaver({ onState: setSaveState }));

  useEffect(() => {
    clearThemeOverrideStorage();
    const saver = saverRef.current;
    return () => saver.dispose();
  }, []);
  const imageOverrides = useKioskImageOverrides();

  const isCheckoutRoute = location.pathname === "/kiosk/checkout";
  const {
    activeSectionId,
    isOpen: isSectionOpen,
    toggle: toggleSection,
  } = useDesignPanelPick({
    active: isCheckoutRoute && open,
    rootSelector: SCOPE_SELECTOR,
    sectionsStorageKey: "checkout-theme-panel-open-sections",
  });

  useEffect(() => {
    for (const key of DEPRECATED_TOKEN_KEYS) {
      clearToken(key);
    }

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

  if (!isCheckoutRoute) return null;


  function handleChange(key: string, value: string) {
    const token = TOKEN_BY_KEY.get(key);
    setValues((prev) => ({ ...prev, [key]: value }));
    applyValue(key, value);
    if (token) {
      saverRef.current.scheduleOne(key, formatCssValue(token, value));
    }
  }

  function handleReset() {
    const defaults = hardcodedDefaults();
    for (const token of ALL_TOKENS) {
      clearToken(token.key);
      applyValue(token.key, defaults[token.key]!);
    }
    setValues(defaults);
    void saverRef.current.saveNow(tokensForCss(defaults));
  }

  function handleResetToken(token: Token) {
    const defaultValue = String(token.defaultValue);
    clearToken(token.key);
    applyValue(token.key, defaultValue);
    setValues((prev) => ({ ...prev, [token.key]: defaultValue }));
    saverRef.current.scheduleOne(token.key, formatCssValue(token, defaultValue));
  }


  async function handleImagePick(key: string, file: File | undefined) {
    if (!file) return;
    await setKioskImageOverride(key, file);
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
    <div
      ref={containerRef}
      {...{ [THEME_PANEL_CHROME_ATTR]: "" }}
      className="fixed right-6 top-[15.5rem] z-50 flex flex-col items-end gap-5"
      style={dragStyle}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки оформления заказа"
        className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <SlidersHorizontal aria-hidden className="h-10 w-10" strokeWidth={1.7} />
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
              <span className="text-2xl font-bold uppercase tracking-wide text-white/90">Настройки оформления заказа</span>
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

          <SettingsPanelGroup label="Изображения">
            <SettingsPanelSection
              id="section-checkout-images"
              title="Иллюстрации"
              open={isSectionOpen("section-checkout-images")}
              onToggle={() => toggleSection("section-checkout-images")}
              highlighted={activeSectionId === "section-checkout-images"}
            >
              {CHECKOUT_IMAGE_DEFINITIONS.map((image) => (
                <CheckoutImagePickerRow
                  key={image.key}
                  image={image}
                  previewUrl={getKioskImageUrl(image.key)}
                  isOverridden={imageOverrides.has(image.key)}
                  onPick={(file) => void handleImagePick(image.key, file)}
                  onReset={() => resetKioskImage(image.key)}
                />
              ))}
            </SettingsPanelSection>
          </SettingsPanelGroup>
          <p className="mt-2 rounded-2xl border-2 border-white/15 bg-white/5 px-4 py-4 text-center text-lg font-semibold uppercase tracking-wide text-white/80">
            {themeSaveStatusLabel(saveState)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CheckoutImagePickerRow({
  image,
  previewUrl,
  isOverridden,
  onPick,
  onReset,
}: {
  image: KioskImageDefinition;
  previewUrl: string;
  isOverridden: boolean;
  onPick: (file: File | undefined) => void;
  onReset: () => void;
}) {
  const inputId = useId();

  return (
    <div className="flex items-center justify-between gap-6 text-xl">
      <span className="min-w-[220px] text-white/80">{image.label}</span>
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
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-xl border-2 border-white/15 bg-white/5 px-4 py-3 text-base font-semibold uppercase tracking-wide text-white/90 transition-colors hover:bg-white/10"
        >
          Заменить
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {isOverridden ? (
          <span className="text-sm text-white/45">своё</span>
        ) : (
          <span className="text-sm text-white/45">иконка по умолчанию</span>
        )}
      </div>
      <button
        type="button"
        onClick={onReset}
        className="shrink-0 rounded-full border-2 border-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-white/50 transition-colors hover:border-white/30 hover:text-white"
      >
        Сброс
      </button>
    </div>
  );
}
