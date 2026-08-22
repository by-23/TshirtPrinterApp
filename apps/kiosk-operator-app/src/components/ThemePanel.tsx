import { useEffect, useId, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { GripVertical, Settings } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  settingsSectionId,
} from "./settingsPanelUi.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";
import { THEME_PANEL_CHROME_ATTR } from "../lib/themePick.js";
import { useDesignPanelPick } from "../lib/useDesignPanelPick.js";
import { HOME_LANG_PICK_ROOT, HOME_THEME_PICK_ROOT } from "../routes/kiosk/themeSectionsHome.js";
import { DEFAULT_UI_FONT, THEME_FONT_OPTIONS } from "../lib/fonts.js";
import {
  PAGE_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_LABELS,
  PAGE_TRANSITION_TYPES,
  usePageTransitionStore,
} from "../lib/pageTransitionStore.js";
import {
  getKioskImageUrl,
  KIOSK_IMAGE_SECTIONS,
  resetHomeKioskImages,
  resetKioskImage,
  setKioskImageOverride,
  useKioskImageOverrides,
  type KioskImageDefinition,
} from "../lib/kioskImages.js";
import {
  clearThemeOverrideStorage,
  createThemeCssSaver,
  overlayThemeRuntimeOverrides,
  themeSaveStatusLabel,
  type ThemeSaveState,
} from "../lib/themeCssSave.js";

const THEME_FONT_SELECT_OPTIONS = THEME_FONT_OPTIONS.map(({ label, family }) => ({
  label,
  value: family,
}));

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
 *
 * Order mirrors the panel: basics → chrome → home-screen blocks.
 */
const SECTIONS: Section[] = [
  {
    title: "Общий фон страницы",
    tokens: [{ key: "--kiosk-page-bg", label: "Фон страницы", type: "color", defaultValue: "#05060f" }],
  },
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
    title: "Переключатель языка",
    tokens: [
      {
        key: "--kiosk-lang-top",
        label: "Позиция по вертикали",
        type: "range",
        defaultValue: 48,
        min: 0,
        max: 400,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-right",
        label: "Позиция по горизонтали (от правого края)",
        type: "range",
        defaultValue: 40,
        min: 0,
        max: 400,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-width",
        label: "Кнопка — ширина",
        type: "range",
        defaultValue: 74,
        min: 16,
        max: 220,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-height",
        label: "Кнопка — высота",
        type: "range",
        defaultValue: 44,
        min: 16,
        max: 220,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-radius",
        label: "Кнопка — скругление",
        type: "range",
        defaultValue: 999,
        min: 0,
        max: 999,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-gap",
        label: "Зазор между кнопками",
        type: "range",
        defaultValue: 10,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-font-size",
        label: "Текст — размер",
        type: "range",
        defaultValue: 15,
        min: 8,
        max: 48,
        step: 1,
        unit: "px",
      },
      {
        key: "--kiosk-lang-btn-active-bg",
        label: "Активная — фон",
        type: "color",
        defaultValue: "#ff2d95",
      },
      {
        key: "--kiosk-lang-btn-idle-bg",
        label: "Неактивная — фон",
        type: "color",
        defaultValue: "#131a2e",
      },
      {
        key: "--kiosk-lang-btn-idle-border",
        label: "Неактивная — обводка",
        type: "color",
        defaultValue: "#26325a",
      },
      {
        key: "--kiosk-lang-btn-idle-text",
        label: "Неактивная — текст",
        type: "color",
        defaultValue: "#a7b0d0",
      },
      {
        key: "--kiosk-lang-btn-active-scale",
        label: "Активная — масштаб",
        type: "range",
        defaultValue: 1.1,
        min: 1,
        max: 1.3,
        step: 0.05,
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
        key: "--popular-title-size",
        label: "Заголовок — размер",
        type: "range",
        defaultValue: 26,
        min: 12,
        max: 64,
        step: 1,
        unit: "px",
      },
      {
        key: "--popular-title-color",
        label: "Заголовок — цвет",
        type: "color",
        defaultValue: "#ff2d95",
      },
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
        key: "--popular-border-radius",
        label: "Скругление обводки",
        type: "range",
        defaultValue: 50,
        min: 0,
        max: 120,
        step: 1,
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
      {
        key: "--popular-arrow-size",
        label: "Стрелки — размер",
        type: "range",
        defaultValue: 40,
        min: 16,
        max: 96,
        step: 2,
        unit: "px",
      },
      {
        key: "--popular-arrow-offset-y",
        label: "Стрелки — высота",
        type: "range",
        defaultValue: 0,
        min: -120,
        max: 120,
        step: 1,
        unit: "px",
      },
      {
        key: "--popular-arrow-stroke",
        label: "Стрелки — толщина",
        type: "range",
        defaultValue: 2.6,
        min: 1,
        max: 6,
        step: 0.1,
      },
      {
        key: "--popular-dots-margin-top",
        label: "Точки — отступ сверху",
        type: "range",
        defaultValue: 28,
        min: 0,
        max: 80,
        step: 2,
        unit: "px",
      },
      {
        key: "--popular-dots-margin-bottom",
        label: "Точки — отступ снизу",
        type: "range",
        defaultValue: 40,
        min: 0,
        max: 80,
        step: 2,
        unit: "px",
      },
      {
        key: "--popular-likes-heart-size",
        label: "Лайк — размер",
        type: "range",
        defaultValue: 14,
        min: 8,
        max: 96,
        step: 1,
        unit: "px",
      },
      {
        key: "--popular-likes-font-size",
        label: "Текст — размер",
        type: "range",
        defaultValue: 13,
        min: 8,
        max: 80,
        step: 1,
        unit: "px",
      },
      {
        key: "--popular-likes-bg-color",
        label: "Фон — цвет",
        type: "color",
        defaultValue: "#05060f",
      },
      {
        key: "--popular-likes-bg-blur",
        label: "Фон — размытие",
        type: "range",
        defaultValue: 8,
        min: 0,
        max: 32,
        step: 0.5,
        unit: "px",
      },
      {
        key: "--popular-border-spin-duration",
        label: "Обводка — скорость вращения",
        type: "range",
        defaultValue: 10,
        min: 2,
        max: 40,
        step: 0.5,
        unit: "s",
      },
      { key: "--popular-border-c1", label: "Обводка — цвет 1", type: "color", defaultValue: "#ff2d95" },
      { key: "--popular-border-c2", label: "Обводка — цвет 2", type: "color", defaultValue: "#22d3f5" },
      { key: "--popular-border-c3", label: "Обводка — цвет 3", type: "color", defaultValue: "#8b5cf6" },
    ],
  },
  {
    title: "Ambient — анимированный фон",
    tokens: [
      {
        key: "--ambient-enabled",
        label: "Включён",
        type: "select",
        defaultValue: "1",
        options: [
          { label: "Включён", value: "1" },
          { label: "Выключен", value: "0" },
        ],
      },
      {
        key: "--ambient-blur",
        label: "Блюр стекла",
        type: "range",
        defaultValue: 16,
        min: 0,
        max: 48,
        step: 1,
        unit: "px",
      },
      {
        key: "--ambient-frost-opacity",
        label: "Плотность стекла",
        type: "range",
        defaultValue: 0.35,
        min: 0,
        max: 1,
        step: 0.05,
      },
      {
        key: "--ambient-orb-count",
        label: "Число огоньков",
        type: "range",
        defaultValue: 8,
        min: 0,
        max: 24,
        step: 1,
      },
      {
        key: "--ambient-orb-size",
        label: "Размер огоньков",
        type: "range",
        defaultValue: 160,
        min: 40,
        max: 400,
        step: 5,
        unit: "px",
      },
      {
        key: "--ambient-orb-speed",
        label: "Скорость движения огоньков",
        type: "range",
        defaultValue: 1,
        min: 0,
        max: 4,
        step: 0.1,
      },
      {
        key: "--ambient-color-shift-speed",
        label: "Скорость смены цвета",
        type: "range",
        defaultValue: 1,
        min: 0,
        max: 4,
        step: 0.1,
      },
      {
        key: "--ambient-color-shift-amp",
        label: "Амплитуда смены цвета",
        type: "range",
        defaultValue: 0.25,
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
  },
  {
    title: "Градиенты категорий",
    tokens: [
      { key: "--cat-misc-start", label: "Разное верх", type: "color", defaultValue: "#4f2db8" },
      { key: "--cat-misc-middle", label: "Разное центр", type: "color", defaultValue: "#1f123f" },
      { key: "--cat-misc-end", label: "Разное низ", type: "color", defaultValue: "#05050d" },
      { key: "--cat-misc-border", label: "Разное обводка", type: "color", defaultValue: "#a78bfa" },

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
    key: "--popular-slide-height",
    label: "Высота блока",
    type: "range",
    defaultValue: 330,
    min: 180,
    max: 600,
    step: 10,
    unit: "px",
  },
  {
    key: "--popular-slides-per-view",
    label: "Футболок в ряд",
    type: "range",
    defaultValue: 3,
    min: 1,
    max: 10,
    step: 1,
  },
  {
    key: "--popular-shirt-scale",
    label: "Футболки — масштаб",
    type: "range",
    defaultValue: 1.05,
    min: 0.5,
    max: 4,
    step: 0.05,
  },
  {
    key: "--popular-shirt-offset-y",
    label: "Футболки — вверх / вниз",
    type: "range",
    defaultValue: 0,
    min: -120,
    max: 120,
    step: 1,
    unit: "px",
  },
  {
    key: "--popular-shirt-overlap",
    label: "Футболки — наложение",
    type: "range",
    defaultValue: 48,
    min: -400,
    max: 400,
    step: 2,
    unit: "px",
  },
  {
    key: "--popular-print-scale-min",
    label: "Принты — мин. масштаб",
    type: "range",
    defaultValue: 0.6,
    min: 0.3,
    max: 4,
    step: 0.05,
  },
  {
    key: "--popular-print-scale-max",
    label: "Принты — макс. масштаб",
    type: "range",
    defaultValue: 0.9,
    min: 0.3,
    max: 4,
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
  { title: "РАЗНОЕ", tokens: categoryLayoutTokens("misc") },
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
  return overlayThemeRuntimeOverrides(values, ALL_TOKENS);
}

function defaultValues(): Record<string, string> {
  return getBaselineValues();
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

/** Titles of token sections in the «Основные» group. */
const BASIC_SECTION_TITLES = [
  "Общий фон страницы",
  "Шрифт",
  "Бренд-градиент",
  "Скругления",
  "Свечение",
] as const;

/** Titles of token sections in the «Навигация» group. */
const NAV_SECTION_TITLES = ["Переключатель языка"] as const;

/** Titles of token sections in the «Главный экран» group. */
const HOME_SECTION_TITLES = [
  "Карточки категорий",
  "Плашка «Выберите категорию»",
  "Популярные принты",
  "Ambient — анимированный фон",
  "Градиенты категорий",
] as const;

function sectionsByTitles(titles: readonly string[]): Section[] {
  return pickSectionsByTitle(SECTIONS, titles);
}

/**
 * Floating design panel — every change writes CSS tokens into index.css (dev only).
 */
export function ThemePanel() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("kiosk-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => getBaselineValues());
  const [saveState, setSaveState] = useState<ThemeSaveState>("idle");
  const saverRef = useRef(createThemeCssSaver({ onState: setSaveState }));

  useEffect(() => {
    clearThemeOverrideStorage();
    const saver = saverRef.current;
    return () => saver.dispose();
  }, []);
  const imageOverrides = useKioskImageOverrides();
  const pageTransition = usePageTransitionStore((state) => state.type);
  const pageTransitionDuration = usePageTransitionStore((state) => state.durationMs);
  const setPageTransition = usePageTransitionStore((state) => state.setType);
  const setPageTransitionDuration = usePageTransitionStore((state) => state.setDurationMs);
  const resetPageTransition = usePageTransitionStore((state) => state.reset);

  const isHomeRoute = location.pathname === "/kiosk";
  const {
    activeSectionId,
    isOpen: isSectionOpen,
    toggle: toggleSection,
  } = useDesignPanelPick({
    active: isHomeRoute && open,
    rootSelector: HOME_THEME_PICK_ROOT,
    extraRootSelectors: [HOME_LANG_PICK_ROOT],
    sectionsStorageKey: "kiosk-theme-panel-open-sections",
  });

  const basicSections = sectionsByTitles(BASIC_SECTION_TITLES);
  const navSections = sectionsByTitles(NAV_SECTION_TITLES);
  const homeSections = sectionsByTitles(HOME_SECTION_TITLES);

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

  // Home gear only — other routes have their own design panels.
  if (!isHomeRoute) return null;


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
    resetHomeKioskImages();
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
    const saved = await setKioskImageOverride(key, file);
    if (!saved) {
      window.alert("Не удалось сохранить изображение. Проверьте свободное место на диске.");
    }
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
    <div
      ref={containerRef}
      {...{ [THEME_PANEL_CHROME_ATTR]: "" }}
      className="fixed right-6 top-6 z-50 flex flex-col items-end gap-5"
      style={dragStyle}
    >
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
        <div className="settings-panel-scroll flex max-h-[90vh] w-[720px] flex-col gap-6 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
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
                Дизайн-панель
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

          <SettingsPanelGroup label="Основные">
            {basicSections.map((section) => {
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

          <SettingsPanelGroup label="Навигация">
            {navSections.map((section) => {
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
            <SettingsPanelSection
              id="section-page-transitions"
              title="Переходы между экранами"
              open={isSectionOpen("section-page-transitions")}
              onToggle={() => toggleSection("section-page-transitions")}
              highlighted={activeSectionId === "section-page-transitions"}
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-6 text-xl">
                  <span className="min-w-[180px] text-white/80">Анимация</span>
                  <select
                    value={pageTransition}
                    onChange={(e) => setPageTransition(e.target.value as typeof pageTransition)}
                    className="min-w-[260px] rounded-xl border-2 border-white/15 bg-[#171a28] px-4 py-3 text-lg text-white outline-none transition-colors hover:border-white/30 focus:border-white/40"
                  >
                    {PAGE_TRANSITION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {PAGE_TRANSITION_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-6 text-xl">
                  <span className="min-w-[180px] text-white/80">Длительность</span>
                  <div className="flex min-w-[260px] flex-1 items-center gap-4">
                    <input
                      type="range"
                      min={PAGE_TRANSITION_DURATION_MS.min}
                      max={PAGE_TRANSITION_DURATION_MS.max}
                      step={PAGE_TRANSITION_DURATION_MS.step}
                      value={pageTransitionDuration}
                      disabled={pageTransition === "none"}
                      onChange={(e) => setPageTransitionDuration(Number(e.target.value))}
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-white disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <span className="w-16 shrink-0 text-right tabular-nums text-white/70">
                      {pageTransitionDuration}мс
                    </span>
                  </div>
                </div>
                <p className="text-sm text-white/45">
                  Вперёд — новый экран накрывает предыдущий. Назад — верхний уезжает и открывает тот, что был под ним.
                </p>
                <button
                  type="button"
                  onClick={resetPageTransition}
                  className="self-start rounded-full border-2 border-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide text-white/50 transition-colors hover:border-white/30 hover:text-white"
                >
                  Сброс
                </button>
              </div>
            </SettingsPanelSection>
          </SettingsPanelGroup>

          <SettingsPanelGroup label="Главный экран">
            <SettingsPanelSection
              id="section-images"
              title="Изображения"
              open={isSectionOpen("section-images")}
              onToggle={() => toggleSection("section-images")}
            >
              <SettingsPanelSection
                nested
                id="section-images-popular-size"
                title="Популярные принты — размеры"
                open={isSectionOpen("section-images-popular-size", true)}
                onToggle={() => toggleSection("section-images-popular-size", true)}
              >
                <p className="text-sm text-white/45">
                  Масштаб принта на каждом слайде выбирается случайно между мин. и макс.
                  Смещение вверх/вниз: минус — вверх, плюс — вниз. Наложение: плюс —
                  заходят друг на друга, минус — появляется зазор. Цвета чередуются:
                  чёрная / белая.
                </p>
                {IMAGE_SIZE_TOKENS.map((token) => renderToken(token))}
              </SettingsPanelSection>

              <SettingsPanelSection
                nested
                id="section-images-category-layout"
                title="Категории — размер и позиция"
                open={isSectionOpen("section-images-category-layout")}
                onToggle={() => toggleSection("section-images-category-layout")}
              >
                <p className="text-sm text-white/45">
                  Привязка к нижнему краю. X: минус — влево, плюс — вправо. Y: минус — вверх, плюс — вниз.
                </p>
                {CATEGORY_IMAGE_LAYOUT_SECTIONS.map((section) => {
                  const nestedId = `section-images-cat-${section.title}`;
                  return (
                    <SettingsPanelSection
                      key={section.title}
                      nested
                      id={nestedId}
                      title={section.title}
                      open={isSectionOpen(nestedId)}
                      onToggle={() => toggleSection(nestedId)}
                    >
                      {section.tokens.map((token) => renderToken(token))}
                    </SettingsPanelSection>
                  );
                })}
              </SettingsPanelSection>

              {KIOSK_IMAGE_SECTIONS.map((section) => {
                const nestedId = `section-images-files-${section.title}`;
                return (
                  <SettingsPanelSection
                    key={section.title}
                    nested
                    id={nestedId}
                    title={section.title}
                    open={isSectionOpen(nestedId)}
                    onToggle={() => toggleSection(nestedId)}
                  >
                    {section.images.map((image) => (
                      <KioskImagePickerRow
                        key={image.key}
                        image={image}
                        previewUrl={getKioskImageUrl(image.key)}
                        isOverridden={imageOverrides.has(image.key)}
                        onPick={(file) => handleImagePick(image.key, file)}
                        onReset={() => resetKioskImage(image.key)}
                      />
                    ))}
                  </SettingsPanelSection>
                );
              })}
            </SettingsPanelSection>

            {homeSections.map((section) => {
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
          <p className="mt-2 rounded-2xl border-2 border-white/15 bg-white/5 px-4 py-4 text-center text-lg font-semibold uppercase tracking-wide text-white/80">
            {themeSaveStatusLabel(saveState)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function KioskImagePickerRow({
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
        ) : image.optional ? (
          <span className="text-sm text-white/45">по умолчанию</span>
        ) : (
          <span className="text-sm text-white/45">встроенное</span>
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
