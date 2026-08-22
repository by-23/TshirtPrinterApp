import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  POPULAR_SCROLL_CSS_VARS,
  syncAllPopularScrollElements,
} from "../editor/popularScrollTheme.js";
import {
  clearThemeOverrideStorage,
  createThemeCssSaver,
  overlayThemeRuntimeOverrides,
  themeSaveStatusLabel,
  type ThemeSaveState,
} from "../lib/themeCssSave.js";
import { GripVertical, SlidersVertical } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  scrollToSection,
  settingsSectionId,
  useOpenSections,
} from "./settingsPanelUi.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";
import { THEME_PANEL_CHROME_ATTR, useThemePickMode } from "../lib/themePick.js";

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

/** Border + rounding + padding row set for a tile/chip — see `tileBorderStyle` in `borderStyle.ts`. */
function tileBorderTokens(
  prefix: string,
  defaults: { width: number; color: string; opacity: number; radius: number; bg: string; padding: number },
): Token[] {
  return [
    { key: `--editor-${prefix}-border-width`, label: "Обводка — толщина", defaultValue: defaults.width, ...BORDER_WIDTH_RANGE },
    { key: `--editor-${prefix}-border-color`, label: "Обводка — цвет", type: "color", defaultValue: defaults.color },
    { key: `--editor-${prefix}-border-opacity`, label: "Обводка — прозрачность", defaultValue: defaults.opacity, ...OPACITY_RANGE },
    {
      key: `--editor-${prefix}-radius`,
      label: "Скругление",
      defaultValue: defaults.radius,
      type: "range",
      min: 0,
      max: 56,
      step: 1,
      unit: "px",
    },
    { key: `--editor-${prefix}-bg`, label: "Фон", type: "color", defaultValue: defaults.bg },
    {
      key: `--editor-${prefix}-padding`,
      label: "Внутренний отступ",
      defaultValue: defaults.padding,
      type: "range",
      min: 0,
      max: 32,
      step: 1,
      unit: "px",
    },
  ];
}

const TILE_BORDER_DEFAULT = {
  width: 1.5,
  color: "#242938",
  opacity: 1,
  radius: 12,
  bg: "#0b0f1e",
  padding: 8,
};

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
    title: "Панели инструментов",
    tokens: [
      {
        key: "--editor-tool-popover-width",
        label: "Ширина панели",
        defaultValue: 580,
        type: "range",
        min: 240,
        max: 800,
        step: 4,
        unit: "px",
      },
      {
        key: "--editor-tool-emoji-popover-width",
        label: "Ширина панели эмодзи",
        defaultValue: 720,
        type: "range",
        min: 320,
        max: 1000,
        step: 4,
        unit: "px",
      },
      { key: "--editor-tool-popover-padding", label: "Внутренний отступ", defaultValue: 30, ...GAP_RANGE },
      {
        key: "--editor-tool-popover-radius",
        label: "Скругление",
        defaultValue: 28,
        type: "range",
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
      },
      { key: "--editor-tool-gap", label: "Зазор между элементами", defaultValue: 22, ...GAP_RANGE },
      { key: "--editor-tool-title-size", label: "Заголовок — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--editor-tool-body-size", label: "Текст — размер", defaultValue: 22, ...FONT_RANGE },
      { key: "--editor-tool-caption-size", label: "Подпись — размер", defaultValue: 19, ...FONT_RANGE },
      { key: "--editor-tool-label-size", label: "Метки — размер", defaultValue: 19, ...FONT_RANGE },
      { key: "--editor-tool-btn-font-size", label: "Кнопка — размер текста", defaultValue: 22, ...FONT_RANGE },
      { key: "--editor-tool-btn-padding-x", label: "Кнопка — отступ по горизонтали", defaultValue: 28, ...GAP_RANGE },
      { key: "--editor-tool-btn-padding-y", label: "Кнопка — отступ по вертикали", defaultValue: 16, ...GAP_RANGE },
      { key: "--editor-tool-chip-font-size", label: "Чип — размер текста", defaultValue: 19, ...FONT_RANGE },
      { key: "--editor-tool-chip-padding-x", label: "Чип — отступ по горизонтали", defaultValue: 18, ...GAP_RANGE },
      { key: "--editor-tool-chip-padding-y", label: "Чип — отступ по вертикали", defaultValue: 14, ...GAP_RANGE },
      { key: "--editor-tool-font-chip-size", label: "Шрифт — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--editor-tool-font-chip-padding-x", label: "Шрифт — отступ по горизонтали", defaultValue: 18, ...GAP_RANGE },
      { key: "--editor-tool-font-chip-padding-y", label: "Шрифт — отступ по вертикали", defaultValue: 14, ...GAP_RANGE },
      { key: "--editor-tool-swatch-size", label: "Цветовой кружок — размер", defaultValue: 58, ...SIZE_RANGE },
      { key: "--editor-tool-checkbox-size", label: "Чекбокс — размер", defaultValue: 32, ...SIZE_RANGE },
      {
        key: "--editor-tool-qr-size",
        label: "QR-код — размер",
        defaultValue: 290,
        type: "range",
        min: 120,
        max: 340,
        step: 1,
        unit: "px",
      },
      { key: "--editor-tool-search-font-size", label: "Поиск — размер текста", defaultValue: 22, ...FONT_RANGE },
      { key: "--editor-tool-search-padding-x", label: "Поиск — отступ по горизонтали", defaultValue: 20, ...GAP_RANGE },
      { key: "--editor-tool-search-padding-y", label: "Поиск — отступ по вертикали", defaultValue: 16, ...GAP_RANGE },
      { key: "--editor-tool-search-icon-size", label: "Поиск — иконка", defaultValue: 30, ...SIZE_RANGE },
      {
        key: "--editor-tool-emoji-grid-min-height",
        label: "Сетка эмодзи — мин. высота",
        defaultValue: 256,
        type: "range",
        min: 80,
        max: 400,
        step: 4,
        unit: "px",
      },
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
        key: "--editor-strip-width",
        label: "Ширина блока (0 = как карточка холста)",
        defaultValue: 0,
        ...BLOCK_WIDTH_RANGE,
      },
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
      { key: "--editor-strip-bg", label: "Фон", type: "color", defaultValue: "#02060d" },
      { key: "--editor-strip-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#1c1e26" },
      { key: "--editor-strip-border-width", label: "Обводка — толщина", defaultValue: 1.5, ...BORDER_WIDTH_RANGE },
      { key: "--editor-strip-border-opacity", label: "Обводка — прозрачность", defaultValue: 1, ...OPACITY_RANGE },
      { key: "--editor-strip-height", label: "Высота блока (0 = авто)", defaultValue: 0, ...BLOCK_HEIGHT_RANGE },
      {
        key: "--editor-strip-offset-y",
        label: "Смещение по высоте (− вверх)",
        defaultValue: -100,
        type: "range",
        min: -400,
        max: 200,
        step: 1,
        unit: "px",
      },
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
      { key: "--editor-strip-btn-bg", label: "Кнопки +/− — фон", type: "color", defaultValue: "#02060d" },
      { key: "--editor-strip-btn-width", label: "Кнопки +/− — ширина", defaultValue: 24, ...SIZE_RANGE },
      { key: "--editor-strip-btn-height", label: "Кнопки +/− — высота", defaultValue: 32, ...SIZE_RANGE },
      { key: "--editor-strip-btn-radius", label: "Кнопки +/− — скругление", defaultValue: 0, ...RADIUS_FULL },
      { key: "--editor-strip-label-font-size", label: "Подпись — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--editor-strip-value-font-size", label: "Значение — размер", defaultValue: 16, ...FONT_RANGE },
    ],
  },
  {
    title: "Плавающие кнопки объекта",
    tokens: [
      { key: "--editor-objctrl-bar-radius", label: "Скругление панели", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-objctrl-btn-width", label: "Кнопки — ширина", defaultValue: 72, ...SIZE_RANGE },
      { key: "--editor-objctrl-btn-height", label: "Кнопки — высота", defaultValue: 72, ...SIZE_RANGE },
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
    title: "Кнопка «Предпросмотр»",
    tokens: [
      { key: "--editor-secondary-btn-height", label: "Высота кнопки", defaultValue: 48, ...SIZE_RANGE },
      { key: "--editor-secondary-btn-radius", label: "Скругление", defaultValue: 999, ...RADIUS_FULL },
      { key: "--editor-secondary-btn-bg", label: "Фон", type: "color", defaultValue: "#131a2e" },
      { key: "--editor-secondary-btn-font-size", label: "Текст — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-secondary-btn-icon-size", label: "Иконка — размер", defaultValue: 18, ...FONT_RANGE },
      ...blockBorderTokens("secondary-block", { ...BLOCK_BORDER_DEFAULT, radius: 16, padding: 12 }),
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
        label: "Ширина блока (0 = на всю ширину)",
        defaultValue: 0,
        ...BLOCK_WIDTH_RANGE,
      },
      { key: "--editor-popular-title-size", label: "Заголовок — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--editor-popular-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#9ca3af" },
      {
        key: "--editor-popular-title-gap",
        label: "Отступ заголовок → ряд",
        defaultValue: 12,
        ...LAYOUT_GAP_RANGE,
      },
      { key: "--editor-popular-image-width", label: "Плитка — мин. ширина", defaultValue: 120, ...SIZE_RANGE },
      { key: "--editor-popular-image-height", label: "Плитка — высота", defaultValue: 88, ...SIZE_RANGE },
      {
        key: "--editor-popular-tile-flex-grow",
        label: "Растягивать плитки (0 = фикс., 1+ = заполнить ряд)",
        defaultValue: 1,
        type: "range",
        min: 0,
        max: 4,
        step: 1,
      },
      {
        key: "--editor-popular-image-gap",
        label: "Отступ между плитками",
        defaultValue: 16,
        ...LAYOUT_GAP_RANGE,
      },
      {
        key: "--editor-popular-image-padding",
        label: "Картинка — внутренний отступ",
        defaultValue: 4,
        type: "range",
        min: 0,
        max: 24,
        step: 1,
        unit: "px",
      },
      ...tileBorderTokens("popular-tile", TILE_BORDER_DEFAULT),
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
        label: "Ширина блока (0 = на всю ширину)",
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

const PANEL_GROUPS: Array<{ label: string; titles: readonly string[] }> = [
  {
    label: "Основные",
    titles: ["Общий фон страницы", "Отступы между блоками"],
  },
  {
    label: "Шапка",
    titles: ["Шапка", "Переключатель стороны печати"],
  },
  {
    label: "Левая зона",
    titles: ["Левая панель инструментов", "Панели инструментов"],
  },
  {
    label: "Холст",
    titles: ["Карточка холста", "Полоска управления объектом", "Плавающие кнопки объекта"],
  },
  {
    label: "Правая панель",
    titles: [
      "Правая панель",
      "Цвет изделия (плитки)",
      "Размер (кнопки)",
      "Материал (кнопки)",
      "Кнопка «Предпросмотр»",
      "Цена и печать",
      "«Заказ сохраняется после оплаты» (сноска)",
    ],
  },
  {
    label: "Низ экрана",
    titles: ["Популярные элементы", "Советы"],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
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
  // Control strip: 0 = fixed canvas card width (not full page).
  if (token.key === "--editor-strip-width" && normalized === "0") {
    return "var(--editor-canvas-card-width)";
  }
  // Popular / Tips: 0 means 100% of the editor band.
  if (
    (token.key === "--editor-popular-block-width" || token.key === "--editor-tips-block-width") &&
    normalized === "0"
  ) {
    return "100%";
  }
  if (token.key.endsWith("-block-width") && normalized === "0") return "fit-content";
  if (token.key.endsWith("-content-align")) return normalized === "1" ? "center" : "start";
  return token.type === "range" && token.unit ? `${normalized}${token.unit}` : normalized;
}

function cssRawToState(token: Token, raw: string): string {
  if (token.key.endsWith("-height") && raw === "auto") return "0";
  if (token.key === "--editor-strip-width" && (raw === "var(--editor-canvas-card-width)" || raw === "100%")) {
    return "0";
  }
  if (
    (token.key === "--editor-popular-block-width" || token.key === "--editor-tips-block-width") &&
    raw === "100%"
  ) {
    return "0";
  }
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
 * Floating design panel for `/kiosk/editor`. Every change writes `--editor-*`
 * tokens straight into `index.css` (dev server only) — no localStorage staging.
 */
export function EditorThemePanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("editor-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => getBaselineValues());
  const [saveState, setSaveState] = useState<ThemeSaveState>("idle");
  const saverRef = useRef(createThemeCssSaver({ onState: setSaveState }));
  const {
    isOpen: isSectionOpen,
    toggle: toggleSection,
    ensureOpen,
  } = useOpenSections("editor-theme-panel-open-sections");

  const isEditorRoute = location.pathname === "/kiosk/editor";
  const pickActive = isEditorRoute && open;

  useThemePickMode({
    active: pickActive,
    rootSelector: SCOPE_SELECTOR,
    activeSectionId,
    onPick: (sectionId) => {
      setActiveSectionId(sectionId);
      ensureOpen(sectionId);
      requestAnimationFrame(() => scrollToSection(sectionId));
    },
  });

  useEffect(() => {
    clearThemeOverrideStorage();
    const saver = saverRef.current;
    return () => saver.dispose();
  }, []);

  useEffect(() => {
    if (!open) setActiveSectionId(null);
  }, [open]);

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
      className="fixed right-6 top-32 z-50 flex flex-col items-end gap-5"
      style={dragStyle}
    >
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
                Настройки редактора
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

          <p className="mt-2 rounded-2xl border-2 border-white/15 bg-white/5 px-4 py-4 text-center text-lg font-semibold uppercase tracking-wide text-white/80">
            {themeSaveStatusLabel(saveState)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
