import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAiFlowStore, type AiFlowStep } from "../lib/aiFlowStore.js";
import { GripVertical, Palette } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  settingsSectionId,
  useOpenSections,
} from "./settingsPanelUi.js";
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

const QR_CARD_HEIGHT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 180,
  max: 1600,
  step: 1,
  unit: "px",
};

const NUMBERS_SPACING_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 240,
  step: 1,
  unit: "px",
};

const WAITING_INSTRUCTIONS_GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 0,
  max: 120,
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

const PHOTO_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 80,
  max: 1200,
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

const BLOCK_WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 120,
  max: 1080,
  step: 1,
  unit: "px",
};

const TIMER_VALUE_FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = {
  type: "range",
  min: 16,
  max: 120,
  step: 1,
  unit: "px",
};

interface BlockBorderStyleDefaults {
  color: string;
  opacity: number;
  radius: number;
  padding: number;
}

/** Color, opacity, radius and padding for an AI QR block — border width lives in «QR — обводки». */
function aiQrBlockStyleTokens(blockPrefix: string, defaults: BlockBorderStyleDefaults): Token[] {
  return [
    {
      key: `--ai-qr-${blockPrefix}-border-color`,
      label: "Обводка — цвет",
      type: "color",
      defaultValue: defaults.color,
    },
    {
      key: `--ai-qr-${blockPrefix}-border-opacity`,
      label: "Обводка — прозрачность",
      defaultValue: defaults.opacity,
      ...OPACITY_RANGE,
    },
    {
      key: `--ai-qr-${blockPrefix}-radius`,
      label: "Скругление блока",
      defaultValue: defaults.radius,
      ...RADIUS_RANGE,
    },
    {
      key: `--ai-qr-${blockPrefix}-padding`,
      label: "Внутренний отступ",
      defaultValue: defaults.padding,
      ...PADDING_RANGE,
    },
  ];
}

const QR_OUTLINE_WIDTH_TOKENS: Token[] = [
  { key: "--ai-qr-card-border-width", label: "Карточка QR", defaultValue: 4.5, ...BORDER_WIDTH_RANGE },
  { key: "--ai-qr-timer-box-border-width", label: "Рамка таймера", defaultValue: 1.5, ...BORDER_WIDTH_RANGE },
  { key: "--ai-qr-steps-block-border-width", label: "Рамка инструкций", defaultValue: 1.5, ...BORDER_WIDTH_RANGE },
  { key: "--ai-qr-steps-divider-width", label: "Разделители шагов", defaultValue: 1.5, ...BORDER_WIDTH_RANGE },
  { key: "--ai-qr-steps-badge-border-width", label: "Обводка номера шага", defaultValue: 1, ...BORDER_WIDTH_RANGE },
];

/** Shared step indicator (Фото → Стиль → Обработка → Результат) — used on style, processing and result screens. */
const AI_STEPS_TOKENS: Token[] = [
  { key: "--ai-steps-max-width", label: "Ширина блока", defaultValue: 960, ...BLOCK_WIDTH_RANGE },
  { key: "--ai-steps-padding-y", label: "Отступ сверху/снизу", defaultValue: 0, ...PADDING_RANGE },
  { key: "--ai-steps-circle-size", label: "Круг — размер", defaultValue: 52, ...SIZE_RANGE },
  { key: "--ai-steps-node-border-width", label: "Круг — обводка", defaultValue: 2, ...BORDER_WIDTH_RANGE },
  { key: "--ai-steps-node-icon-size", label: "Иконка — размер", defaultValue: 22, ...SIZE_RANGE },
  { key: "--ai-steps-done-border-color", label: "Готово — обводка", type: "color", defaultValue: "#34d399" },
  { key: "--ai-steps-done-bg-color", label: "Готово — фон", type: "color", defaultValue: "#34d399" },
  { key: "--ai-steps-done-bg-opacity", label: "Готово — прозрачность фона", defaultValue: 0.15, ...OPACITY_RANGE },
  { key: "--ai-steps-done-icon-color", label: "Готово — иконка", type: "color", defaultValue: "#34d399" },
  { key: "--ai-steps-active-border-color", label: "Активный — обводка", type: "color", defaultValue: "#ff2d95" },
  { key: "--ai-steps-active-bg-color", label: "Активный — фон", type: "color", defaultValue: "#ff2d95" },
  { key: "--ai-steps-active-bg-opacity", label: "Активный — прозрачность фона", defaultValue: 0.15, ...OPACITY_RANGE },
  { key: "--ai-steps-active-icon-color", label: "Активный — иконка", type: "color", defaultValue: "#ff2d95" },
  { key: "--ai-steps-idle-border-color", label: "Ожидание — обводка", type: "color", defaultValue: "#ffffff" },
  { key: "--ai-steps-idle-border-opacity", label: "Ожидание — прозрачность обводки", defaultValue: 0.2, ...OPACITY_RANGE },
  { key: "--ai-steps-idle-icon-color", label: "Ожидание — иконка", type: "color", defaultValue: "#ffffff" },
  { key: "--ai-steps-idle-icon-opacity", label: "Ожидание — прозрачность иконки", defaultValue: 0.4, ...OPACITY_RANGE },
  { key: "--ai-steps-label-gap", label: "Зазор круг/подпись", defaultValue: 8, ...GAP_RANGE },
  { key: "--ai-steps-label-size", label: "Подпись — размер", defaultValue: 18, ...FONT_RANGE },
  { key: "--ai-steps-label-done-color", label: "Подпись готово — цвет", type: "color", defaultValue: "#ffffff" },
  { key: "--ai-steps-label-active-color", label: "Подпись активная — цвет", type: "color", defaultValue: "#ff2d95" },
  { key: "--ai-steps-label-idle-color", label: "Подпись ожидание — цвет", type: "color", defaultValue: "#ffffff" },
  { key: "--ai-steps-label-idle-opacity", label: "Подпись ожидание — прозрачность", defaultValue: 0.4, ...OPACITY_RANGE },
  { key: "--ai-steps-active-underline-height", label: "Подчёркивание — высота", defaultValue: 3, ...BORDER_WIDTH_RANGE },
  { key: "--ai-steps-active-underline-color", label: "Подчёркивание — цвет", type: "color", defaultValue: "#ff2d95" },
  {
    key: "--ai-steps-active-underline-margin-top",
    label: "Подчёркивание — отступ сверху",
    defaultValue: 4,
    ...GAP_RANGE,
  },
  { key: "--ai-steps-connector-width", label: "Линия — ширина", defaultValue: 48, ...BLOCK_WIDTH_RANGE },
  { key: "--ai-steps-connector-height", label: "Линия — высота", defaultValue: 2, ...BORDER_WIDTH_RANGE },
  { key: "--ai-steps-connector-done-color", label: "Линия готово — цвет", type: "color", defaultValue: "#ff2d95" },
  { key: "--ai-steps-connector-idle-color", label: "Линия ожидание — цвет", type: "color", defaultValue: "#ffffff" },
  { key: "--ai-steps-connector-idle-opacity", label: "Линия ожидание — прозрачность", defaultValue: 0.15, ...OPACITY_RANGE },
];

/**
 * Every tunable AI screen token (source select + QR upload + style select + result). Values MUST match defaults in `index.css`.
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
  {
    title: "QR — экран",
    tokens: [
      { key: "--ai-qr-screen-padding-x", label: "Отступы по бокам", defaultValue: 40, ...PADDING_RANGE },
      { key: "--ai-qr-screen-padding-top", label: "Отступ сверху", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-qr-screen-padding-bottom", label: "Отступ снизу", defaultValue: 48, ...PADDING_RANGE },
      { key: "--ai-qr-main-gap", label: "Зазор в центральной зоне", defaultValue: 32, ...GAP_RANGE },
      { key: "--ai-qr-main-padding-y", label: "Центр — отступ сверху/снизу", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-qr-footer-gap", label: "Зазор в нижней зоне", defaultValue: 36, ...GAP_RANGE },
    ],
  },
  {
    title: "QR — заголовок",
    tokens: [
      { key: "--ai-qr-header-title-size", label: "Заголовок — размер", defaultValue: 38, ...FONT_RANGE },
      { key: "--ai-qr-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-header-subtitle-size", label: "Подзаголовок — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--ai-qr-header-subtitle-color", label: "Подзаголовок — цвет", type: "color", defaultValue: "#ffffff" },
      {
        key: "--ai-qr-header-subtitle-margin-top",
        label: "Подзаголовок — отступ сверху",
        defaultValue: 8,
        ...GAP_RANGE,
      },
    ],
  },
  {
    title: "QR — карточка",
    tokens: [
      { key: "--ai-qr-card-max-width", label: "Ширина блока", defaultValue: 920, ...CARD_WIDTH_RANGE },
      { key: "--ai-qr-card-min-height", label: "Высота блока", defaultValue: 720, ...QR_CARD_HEIGHT_RANGE },
      {
        key: "--ai-qr-card-bg-direction",
        label: "Фон — направление",
        defaultValue: "to bottom",
        ...GRADIENT_DIRECTION,
      },
      { key: "--ai-qr-card-bg-start", label: "Фон — верх", type: "color", defaultValue: "#842050" },
      { key: "--ai-qr-card-bg-end", label: "Фон — низ", type: "color", defaultValue: "#07060c" },
      { key: "--ai-qr-card-gap", label: "Зазор между элементами", defaultValue: 20, ...GAP_RANGE },
      { key: "--ai-qr-card-glow-size", label: "Свечение — размер", defaultValue: 72, ...GLOW_SIZE_RANGE },
      { key: "--ai-qr-card-glow-spread", label: "Свечение — spread", defaultValue: 0, ...GLOW_SPREAD_RANGE },
      { key: "--ai-qr-card-glow-color", label: "Свечение — цвет", type: "color", defaultValue: "#ff3898" },
      { key: "--ai-qr-card-glow-opacity", label: "Свечение — прозрачность", defaultValue: 0.45, ...OPACITY_RANGE },
      ...aiQrBlockStyleTokens("card", {
        color: "#ff3898",
        opacity: 0.75,
        radius: 28,
        padding: 40,
      }),
    ],
  },
  {
    title: "QR — текст в карточке",
    tokens: [
      { key: "--ai-qr-scan-title-size", label: "«Отсканируйте QR» — размер", defaultValue: 28, ...FONT_RANGE },
      { key: "--ai-qr-scan-title-color", label: "«Отсканируйте QR» — цвет", type: "color", defaultValue: "#ff3898" },
      { key: "--ai-qr-scan-subtitle-size", label: "Подпись — размер", defaultValue: 22, ...FONT_RANGE },
      { key: "--ai-qr-scan-subtitle-color", label: "Подпись — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-scan-subtitle-width", label: "Подпись — ширина", defaultValue: 420, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-qr-note-size", label: "Примечание — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-qr-note-color", label: "Примечание — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-note-width", label: "Примечание — ширина", defaultValue: 360, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-qr-error-size", label: "Ошибка — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-qr-error-color", label: "Ошибка — цвет", type: "color", defaultValue: "#fca5a5" },
    ],
  },
  {
    title: "QR — код",
    tokens: [
      { key: "--ai-qr-code-size", label: "QR-код — размер", defaultValue: 280, ...ICON_SIZE_RANGE },
      { key: "--ai-qr-code-radius", label: "QR-код — скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--ai-qr-code-padding", label: "QR-код — внутренний отступ", defaultValue: 14, ...PADDING_RANGE },
    ],
  },
  {
    title: "QR — таймер",
    tokens: [
      { key: "--ai-qr-timer-label-size", label: "Подпись — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-qr-timer-label-color", label: "Подпись — цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-qr-timer-value-size", label: "Цифры — размер", defaultValue: 64, ...TIMER_VALUE_FONT_RANGE },
      { key: "--ai-qr-timer-value-color", label: "Цифры — цвет", type: "color", defaultValue: "#ff3898" },
      {
        key: "--ai-qr-timer-box-border-color",
        label: "Рамка — цвет",
        type: "color",
        defaultValue: "#721c46",
      },
      {
        key: "--ai-qr-timer-box-border-opacity",
        label: "Рамка — прозрачность",
        defaultValue: 0.75,
        ...OPACITY_RANGE,
      },
      { key: "--ai-qr-timer-box-radius", label: "Рамка — скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--ai-qr-timer-box-padding-x", label: "Рамка — отступ X", defaultValue: 40, ...PADDING_RANGE },
      { key: "--ai-qr-timer-box-padding-y", label: "Рамка — отступ Y", defaultValue: 18, ...PADDING_RANGE },
      { key: "--ai-qr-timer-box-gap", label: "Рамка — зазор", defaultValue: 8, ...GAP_RANGE },
      { key: "--ai-qr-timer-box-bg", label: "Рамка — фон", type: "color", defaultValue: "#310f23" },
    ],
  },
  {
    title: "QR — ожидание",
    tokens: [
      { key: "--ai-qr-waiting-gap", label: "Зазор иконка/текст", defaultValue: 20, ...GAP_RANGE },
      { key: "--ai-qr-waiting-size", label: "Спиннер — размер", defaultValue: 52, ...SIZE_RANGE },
      { key: "--ai-qr-waiting-dot-size", label: "Спиннер — точка", defaultValue: 10, ...SIZE_RANGE },
      { key: "--ai-qr-waiting-color", label: "Цвет", type: "color", defaultValue: "#22d3f5" },
      { key: "--ai-qr-waiting-font-size", label: "Текст — размер", defaultValue: 38, ...FONT_RANGE },
      {
        key: "--ai-qr-waiting-instructions-gap",
        label: "Отступ до инструкции",
        defaultValue: 32,
        ...WAITING_INSTRUCTIONS_GAP_RANGE,
      },
    ],
  },
  {
    title: "QR — инструкция (шаги 1-2-3)",
    tokens: [
      { key: "--ai-qr-steps-max-width", label: "Ширина блока", defaultValue: 900, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-qr-steps-numbers-gap", label: "Отступ номеров от рамки", defaultValue: 14, ...GAP_RANGE },
      {
        key: "--ai-qr-steps-numbers-spacing",
        label: "Расстояние между цифрами",
        defaultValue: 48,
        ...NUMBERS_SPACING_RANGE,
      },
      ...aiQrBlockStyleTokens("steps-block", {
        color: "#242938",
        opacity: 1,
        radius: 16,
        padding: 28,
      }),
      { key: "--ai-qr-steps-block-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#0b0f1e" },
      { key: "--ai-qr-steps-block-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.45, ...OPACITY_RANGE },
      { key: "--ai-qr-steps-badge-size", label: "Номер — размер", defaultValue: 60, ...SIZE_RANGE },
      { key: "--ai-qr-steps-badge-font-size", label: "Номер — шрифт", defaultValue: 28, ...FONT_RANGE },
      {
        key: "--ai-qr-steps-badge-border-color",
        label: "Номер — цвет обводки",
        type: "color",
        defaultValue: "#ffffff",
      },
      {
        key: "--ai-qr-steps-badge-border-opacity",
        label: "Номер — прозрачность обводки",
        defaultValue: 0.35,
        ...OPACITY_RANGE,
      },
      { key: "--ai-qr-steps-icon-size", label: "Иконка — размер", defaultValue: 80, ...ICON_SIZE_RANGE },
      { key: "--ai-qr-steps-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-steps-text-size", label: "Текст — размер", defaultValue: 28, ...FONT_RANGE },
      { key: "--ai-qr-steps-text-color", label: "Текст — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-steps-item-gap", label: "Зазор внутри шага", defaultValue: 22, ...GAP_RANGE },
      { key: "--ai-qr-steps-divider-color", label: "Разделитель — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-qr-steps-divider-opacity", label: "Разделитель — прозрачность", defaultValue: 0.18, ...OPACITY_RANGE },
      { key: "--ai-qr-steps-divider-inset-y", label: "Разделитель — отступ сверху/снизу", defaultValue: 16, ...PADDING_RANGE },
    ],
  },
  {
    title: "QR — обводки (толщина)",
    tokens: QR_OUTLINE_WIDTH_TOKENS,
  },
  {
    title: "QR — ссылка на камеру",
    tokens: [
      { key: "--ai-qr-camera-link-size", label: "Текст — размер", defaultValue: 22, ...FONT_RANGE },
      { key: "--ai-qr-camera-link-color", label: "Текст — цвет", type: "color", defaultValue: "#22d3f5" },
    ],
  },
  {
    title: "Стиль — экран",
    tokens: [
      { key: "--ai-style-screen-padding-x", label: "Отступы по бокам", defaultValue: 40, ...PADDING_RANGE },
      { key: "--ai-style-screen-padding-top", label: "Отступ сверху", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-style-screen-padding-bottom", label: "Отступ снизу", defaultValue: 28, ...PADDING_RANGE },
      { key: "--ai-style-screen-gap", label: "Зазор между блоками", defaultValue: 20, ...GAP_RANGE },
    ],
  },
  {
    title: "Стиль — заголовок",
    tokens: [
      { key: "--ai-style-header-title-size", label: "Заголовок — размер", defaultValue: 42, ...FONT_RANGE },
      { key: "--ai-style-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-header-subtitle-size", label: "Подзаголовок — размер", defaultValue: 26, ...FONT_RANGE },
      { key: "--ai-style-header-subtitle-color", label: "Подзаголовок — цвет", type: "color", defaultValue: "#a7b0d0" },
      {
        key: "--ai-style-header-subtitle-margin-top",
        label: "Подзаголовок — отступ сверху",
        defaultValue: 8,
        ...GAP_RANGE,
      },
    ],
  },
  {
    title: "Стиль — превью фото",
    tokens: [
      { key: "--ai-style-photo-row-gap", label: "Зазор бейдж/фото", defaultValue: 24, ...GAP_RANGE },
      { key: "--ai-style-photo-width", label: "Фото — ширина", defaultValue: 220, ...PHOTO_WIDTH_RANGE },
      { key: "--ai-style-photo-height", label: "Фото — высота", defaultValue: 280, ...CARD_HEIGHT_RANGE },
      { key: "--ai-style-photo-radius", label: "Фото — скругление", defaultValue: 20, ...RADIUS_RANGE },
      { key: "--ai-style-photo-border-width", label: "Фото — обводка толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-photo-border-color", label: "Фото — обводка цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-photo-border-opacity", label: "Фото — обводка прозрачность", defaultValue: 0.12, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Стиль — бейдж «Фото загружено»",
    tokens: [
      { key: "--ai-style-photo-badge-gap", label: "Зазор текст/иконка", defaultValue: 10, ...GAP_RANGE },
      { key: "--ai-style-photo-badge-padding-x", label: "Отступы по бокам", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-style-photo-badge-padding-y", label: "Отступы сверху/снизу", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-style-photo-badge-radius", label: "Скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-style-photo-badge-border-width", label: "Обводка — толщина", defaultValue: 2, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-photo-badge-border-color", label: "Обводка — цвет", type: "color", defaultValue: "#34d399" },
      { key: "--ai-style-photo-badge-border-opacity", label: "Обводка — прозрачность", defaultValue: 0.55, ...OPACITY_RANGE },
      { key: "--ai-style-photo-badge-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#34d399" },
      { key: "--ai-style-photo-badge-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.12, ...OPACITY_RANGE },
      { key: "--ai-style-photo-badge-font-size", label: "Текст — размер", defaultValue: 26, ...FONT_RANGE },
      { key: "--ai-style-photo-badge-color", label: "Текст — цвет", type: "color", defaultValue: "#34d399" },
      { key: "--ai-style-photo-badge-icon-size", label: "Иконка — размер", defaultValue: 30, ...SIZE_RANGE },
    ],
  },
  {
    title: "Стиль — галочка «Вырезать фон»",
    tokens: [
      { key: "--ai-style-bg-option-gap", label: "Зазор галочка/текст", defaultValue: 14, ...GAP_RANGE },
      { key: "--ai-style-bg-option-padding-x", label: "Отступы по бокам", defaultValue: 20, ...PADDING_RANGE },
      { key: "--ai-style-bg-option-padding-y", label: "Отступы сверху/снизу", defaultValue: 14, ...PADDING_RANGE },
      { key: "--ai-style-bg-option-radius", label: "Скругление", defaultValue: 20, ...RADIUS_RANGE },
      { key: "--ai-style-bg-option-border-width", label: "Рамка — толщина", defaultValue: 3, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-bg-option-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-bg-option-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.16, ...OPACITY_RANGE },
      { key: "--ai-style-bg-option-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#0a0a12" },
      { key: "--ai-style-bg-option-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.72, ...OPACITY_RANGE },
      { key: "--ai-style-bg-option-font-size", label: "Текст — размер", defaultValue: 26, ...FONT_RANGE },
      { key: "--ai-style-bg-option-color", label: "Текст — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-bg-option-mark-size", label: "Квадрат — размер", defaultValue: 36, ...SIZE_RANGE },
      { key: "--ai-style-bg-option-mark-border-width", label: "Квадрат — обводка толщина", defaultValue: 0, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-bg-option-mark-border-color", label: "Квадрат — обводка цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-style-bg-option-mark-bg", label: "Квадрат — фон", type: "color", defaultValue: "#12121c" },
      { key: "--ai-style-bg-option-checked-border-color", label: "Включено — рамка цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-bg-option-checked-border-opacity", label: "Включено — рамка прозрачность", defaultValue: 0.72, ...OPACITY_RANGE },
      { key: "--ai-style-bg-option-checked-bg-color", label: "Включено — фон цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-bg-option-checked-bg-opacity", label: "Включено — фон прозрачность", defaultValue: 0.12, ...OPACITY_RANGE },
      { key: "--ai-style-bg-option-checked-glow-size", label: "Включено — свечение размер", defaultValue: 18, ...GLOW_SIZE_RANGE },
      { key: "--ai-style-bg-option-checked-glow-color", label: "Включено — свечение цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-bg-option-checked-glow-opacity", label: "Включено — свечение прозрачность", defaultValue: 0.35, ...OPACITY_RANGE },
      { key: "--ai-style-bg-option-checked-mark-bg", label: "Включено — квадрат фон", type: "color", defaultValue: "#1f0512" },
      { key: "--ai-style-bg-option-checked-mark-color", label: "Включено — галочка цвет", type: "color", defaultValue: "#ffffff" },
    ],
  },
  {
    title: "Стиль — индикатор шагов",
    tokens: AI_STEPS_TOKENS,
  },
  {
    title: "Стиль — карточки (общие)",
    tokens: [
      { key: "--ai-style-cards-max-width", label: "Ширина сетки", defaultValue: 1080, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-style-cards-gap", label: "Зазор между карточками", defaultValue: 20, ...GAP_RANGE },
      { key: "--ai-style-cards-padding-y", label: "Отступы сверху/снизу", defaultValue: 8, ...PADDING_RANGE },
      { key: "--ai-style-cards-scroll-size", label: "Скролл — ширина", type: "range", defaultValue: 8, min: 2, max: 20, step: 1, unit: "px" },
      { key: "--ai-style-cards-scroll-track-color", label: "Скролл — дорожка цвет", type: "color", defaultValue: "#242938" },
      { key: "--ai-style-cards-scroll-track-opacity", label: "Скролл — дорожка прозрачность", defaultValue: 0.45, ...OPACITY_RANGE },
      { key: "--ai-style-cards-scroll-thumb-color", label: "Скролл — ползунок цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-cards-scroll-thumb-opacity", label: "Скролл — ползунок прозрачность", defaultValue: 0.72, ...OPACITY_RANGE },
      { key: "--ai-style-card-min-height", label: "Мин. высота карточки", defaultValue: 380, ...CARD_HEIGHT_RANGE },
      { key: "--ai-style-card-radius", label: "Скругление", defaultValue: 22, ...RADIUS_RANGE },
      { key: "--ai-style-card-border-width", label: "Рамка — толщина", defaultValue: 2, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-card-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-card-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.12, ...OPACITY_RANGE },
      { key: "--ai-style-card-bg", label: "Фон карточки", type: "color", defaultValue: "#0a0a12" },
      { key: "--ai-style-card-selected-border-width", label: "Выбрана — толщина рамки", defaultValue: 3, ...BORDER_WIDTH_RANGE },
      { key: "--ai-style-card-selected-border-color", label: "Выбрана — цвет рамки", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-card-selected-glow-size", label: "Выбрана — свечение размер", defaultValue: 24, ...GLOW_SIZE_RANGE },
      { key: "--ai-style-card-selected-glow-spread", label: "Выбрана — свечение spread", defaultValue: 0, ...GLOW_SPREAD_RANGE },
      { key: "--ai-style-card-selected-glow-color", label: "Выбрана — свечение цвет", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-card-selected-glow-opacity", label: "Выбрана — свечение прозрачность", defaultValue: 0.55, ...OPACITY_RANGE },
      { key: "--ai-style-card-active-scale", label: "Сжатие при нажатии", defaultValue: 0.98, ...SCALE_RANGE },
      { key: "--ai-style-card-title-size", label: "Заголовок — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--ai-style-card-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-card-title-padding-x", label: "Заголовок — отступ X", defaultValue: 14, ...PADDING_RANGE },
      { key: "--ai-style-card-title-padding-top", label: "Заголовок — отступ сверху", defaultValue: 10, ...PADDING_RANGE },
      { key: "--ai-style-card-title-padding-bottom", label: "Заголовок — отступ снизу", defaultValue: 8, ...PADDING_RANGE },
      { key: "--ai-style-card-preview-min-height", label: "Превью — мин. высота", defaultValue: 220, ...CARD_HEIGHT_RANGE },
      { key: "--ai-style-card-desc-size", label: "Описание — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-style-card-desc-color", label: "Описание — цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-style-card-desc-padding-x", label: "Описание — отступ X", defaultValue: 14, ...PADDING_RANGE },
      { key: "--ai-style-card-desc-padding-y", label: "Описание — отступ Y", defaultValue: 10, ...PADDING_RANGE },
    ],
  },
  {
    title: "Стиль — кнопки",
    tokens: [
      { key: "--ai-style-footer-max-width", label: "Ширина блока кнопок", defaultValue: 1080, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-style-footer-gap", label: "Зазор между кнопками", defaultValue: 18, ...GAP_RANGE },
      { key: "--ai-style-back-btn-flex", label: "«Назад» — доля ширины", defaultValue: 1, min: 0.5, max: 3, step: 0.1, type: "range" },
      { key: "--ai-style-stylize-btn-flex", label: "«Стилизовать» — доля ширины", defaultValue: 2.4, min: 0.5, max: 4, step: 0.1, type: "range" },
      { key: "--ai-style-back-btn-radius", label: "«Назад» — скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-style-back-btn-padding-y", label: "«Назад» — отступ Y", defaultValue: 22, ...PADDING_RANGE },
      { key: "--ai-style-back-btn-padding-x", label: "«Назад» — отступ X", defaultValue: 28, ...PADDING_RANGE },
      { key: "--ai-style-back-btn-font-size", label: "«Назад» — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--ai-style-back-btn-bg", label: "«Назад» — фон", type: "color", defaultValue: "#1a1f35" },
      { key: "--ai-style-back-btn-color", label: "«Назад» — текст", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-stylize-btn-radius", label: "«Стилизовать» — скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-style-stylize-btn-padding-y", label: "«Стилизовать» — отступ Y", defaultValue: 22, ...PADDING_RANGE },
      { key: "--ai-style-stylize-btn-padding-x", label: "«Стилизовать» — отступ X", defaultValue: 28, ...PADDING_RANGE },
      { key: "--ai-style-stylize-btn-font-size", label: "«Стилизовать» — размер", defaultValue: 26, ...FONT_RANGE },
      { key: "--ai-style-stylize-btn-bg", label: "«Стилизовать» — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-stylize-btn-color", label: "«Стилизовать» — текст", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-style-stylize-btn-glow-size", label: "«Стилизовать» — свечение", defaultValue: 24, ...GLOW_SIZE_RANGE },
      { key: "--ai-style-stylize-btn-glow-spread", label: "«Стилизовать» — spread", defaultValue: 0, ...GLOW_SPREAD_RANGE },
      { key: "--ai-style-stylize-btn-glow-color", label: "«Стилизовать» — цвет свечения", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-style-stylize-btn-glow-opacity", label: "«Стилизовать» — прозрачность свечения", defaultValue: 0.45, ...OPACITY_RANGE },
      { key: "--ai-style-stylize-btn-disabled-opacity", label: "«Стилизовать» — прозрачность disabled", defaultValue: 0.4, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Стиль — сообщение об ошибке",
    tokens: [
      { key: "--ai-style-error-size", label: "Текст — размер", defaultValue: 22, ...FONT_RANGE },
      { key: "--ai-style-error-color", label: "Текст — цвет", type: "color", defaultValue: "#fca5a5" },
      { key: "--ai-style-error-radius", label: "Скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--ai-style-error-padding-x", label: "Отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--ai-style-error-padding-y", label: "Отступ Y", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-style-error-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#f87171" },
      { key: "--ai-style-error-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.3, ...OPACITY_RANGE },
      { key: "--ai-style-error-bg-color", label: "Фон — цвет", type: "color", defaultValue: "#f87171" },
      { key: "--ai-style-error-bg-opacity", label: "Фон — прозрачность", defaultValue: 0.1, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Результат — экран",
    tokens: [
      { key: "--ai-result-screen-padding-x", label: "Отступы по бокам", defaultValue: 40, ...PADDING_RANGE },
      { key: "--ai-result-screen-padding-top", label: "Отступ сверху", defaultValue: 8, ...PADDING_RANGE },
      { key: "--ai-result-screen-padding-bottom", label: "Отступ снизу", defaultValue: 32, ...PADDING_RANGE },
      { key: "--ai-result-screen-gap", label: "Зазор между блоками", defaultValue: 28, ...GAP_RANGE },
      { key: "--ai-result-content-max-width", label: "Ширина контента", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-result-content-gap", label: "Зазор внутри контента", defaultValue: 16, ...GAP_RANGE },
    ],
  },
  {
    title: "Результат — заголовок",
    tokens: [
      { key: "--ai-result-header-title-size", label: "Заголовок — размер", defaultValue: 38, ...FONT_RANGE },
      { key: "--ai-result-header-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-header-subtitle-size", label: "Подзаголовок — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--ai-result-header-subtitle-color", label: "Подзаголовок — цвет", type: "color", defaultValue: "#a7b0d0" },
      {
        key: "--ai-result-header-subtitle-margin-top",
        label: "Подзаголовок — отступ сверху",
        defaultValue: 8,
        ...GAP_RANGE,
      },
    ],
  },
  {
    title: "Результат — индикатор шагов",
    tokens: AI_STEPS_TOKENS,
  },
  {
    title: "Результат — превью",
    tokens: [
      { key: "--ai-result-preview-width", label: "Ширина блока", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-result-preview-height", label: "Высота", defaultValue: 420, ...CARD_HEIGHT_RANGE },
      { key: "--ai-result-preview-radius", label: "Скругление", defaultValue: 24, ...RADIUS_RANGE },
      { key: "--ai-result-preview-bg", label: "Фон", type: "color", defaultValue: "#0a0a12" },
      { key: "--ai-result-preview-border-width", label: "Рамка — толщина", defaultValue: 0, ...BORDER_WIDTH_RANGE },
      { key: "--ai-result-preview-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-preview-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.12, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Результат — переключатель До/После",
    tokens: [
      { key: "--ai-result-toggle-radius", label: "Скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-result-toggle-border-width", label: "Рамка — толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-result-toggle-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-toggle-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.15, ...OPACITY_RANGE },
      { key: "--ai-result-toggle-padding-x", label: "Отступ X", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-result-toggle-padding-y", label: "Отступ Y", defaultValue: 10, ...PADDING_RANGE },
      { key: "--ai-result-toggle-font-size", label: "Текст — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-result-toggle-inactive-color", label: "Неактивный — цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-result-toggle-inactive-bg-color", label: "Неактивный — фон", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-toggle-inactive-bg-opacity", label: "Неактивный — прозрачность фона", defaultValue: 0, ...OPACITY_RANGE },
      { key: "--ai-result-toggle-active-bg", label: "Активный — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-result-toggle-active-color", label: "Активный — текст", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-toggle-active-bg-opacity", label: "Активный — прозрачность фона", defaultValue: 1, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Результат — карточка статуса",
    tokens: [
      { key: "--ai-result-status-width", label: "Ширина блока", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      {
        key: "--ai-result-status-height",
        label: "Высота блока",
        defaultValue: 72,
        min: 48,
        max: 900,
        step: 1,
        type: "range",
        unit: "px",
      },
      { key: "--ai-result-status-radius", label: "Скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--ai-result-status-border-width", label: "Рамка — толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-result-status-border-color", label: "Рамка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-status-border-opacity", label: "Рамка — прозрачность", defaultValue: 0.1, ...OPACITY_RANGE },
      { key: "--ai-result-status-bg", label: "Фон", type: "color", defaultValue: "#0a0a12" },
      { key: "--ai-result-status-padding-x", label: "Отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--ai-result-status-padding-y", label: "Отступ Y", defaultValue: 12, ...PADDING_RANGE },
      { key: "--ai-result-status-gap", label: "Зазор элементов", defaultValue: 12, ...GAP_RANGE },
      { key: "--ai-result-status-thumb-size", label: "Миниатюра — размер", defaultValue: 48, ...SIZE_RANGE },
      { key: "--ai-result-status-thumb-radius", label: "Миниатюра — скругление", defaultValue: 12, ...RADIUS_RANGE },
      { key: "--ai-result-status-thumb-checker-a", label: "Шахматка — светлая", type: "color", defaultValue: "#3a3a48" },
      { key: "--ai-result-status-thumb-checker-b", label: "Шахматка — тёмная", type: "color", defaultValue: "#2a2a34" },
      { key: "--ai-result-status-thumb-checker-size", label: "Шахматка — размер", defaultValue: 8, min: 4, max: 24, step: 1, type: "range", unit: "px" },
      { key: "--ai-result-status-title-size", label: "Заголовок — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-result-status-title-color", label: "Заголовок — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-status-subtitle-size", label: "Подпись — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--ai-result-status-subtitle-color", label: "Подпись — цвет", type: "color", defaultValue: "#a7b0d0" },
      { key: "--ai-result-status-check-size", label: "Галочка — размер", defaultValue: 20, ...SIZE_RANGE },
      { key: "--ai-result-status-check-color", label: "Галочка — цвет", type: "color", defaultValue: "#34d399" },
    ],
  },
  {
    title: "Результат — кнопки",
    tokens: [
      { key: "--ai-result-actions-max-width", label: "Ширина блока", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-result-actions-gap", label: "Зазор между кнопками", defaultValue: 12, ...GAP_RANGE },
      { key: "--ai-result-primary-btn-radius", label: "Основная — скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-result-primary-btn-padding-y", label: "Основная — отступ Y", defaultValue: 18, ...PADDING_RANGE },
      { key: "--ai-result-primary-btn-padding-x", label: "Основная — отступ X", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-result-primary-btn-font-size", label: "Основная — размер", defaultValue: 20, ...FONT_RANGE },
      { key: "--ai-result-primary-btn-bg", label: "Основная — фон", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-result-primary-btn-color", label: "Основная — текст", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-primary-btn-glow-size", label: "Основная — свечение", defaultValue: 20, ...GLOW_SIZE_RANGE },
      { key: "--ai-result-primary-btn-glow-spread", label: "Основная — spread", defaultValue: 0, ...GLOW_SPREAD_RANGE },
      { key: "--ai-result-primary-btn-glow-color", label: "Основная — цвет свечения", type: "color", defaultValue: "#ff2d95" },
      { key: "--ai-result-primary-btn-glow-opacity", label: "Основная — прозрачность свечения", defaultValue: 0.45, ...OPACITY_RANGE },
      { key: "--ai-result-primary-btn-active-scale", label: "Основная — сжатие при нажатии", defaultValue: 0.98, ...SCALE_RANGE },
      { key: "--ai-result-secondary-btn-radius", label: "Вторичная — скругление", defaultValue: 999, ...RADIUS_RANGE },
      { key: "--ai-result-secondary-btn-padding-y", label: "Вторичная — отступ Y", defaultValue: 18, ...PADDING_RANGE },
      { key: "--ai-result-secondary-btn-padding-x", label: "Вторичная — отступ X", defaultValue: 24, ...PADDING_RANGE },
      { key: "--ai-result-secondary-btn-font-size", label: "Вторичная — размер", defaultValue: 18, ...FONT_RANGE },
      { key: "--ai-result-secondary-btn-bg", label: "Вторичная — фон", type: "color", defaultValue: "#0a0a12" },
      { key: "--ai-result-secondary-btn-color", label: "Вторичная — текст", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-secondary-btn-border-width", label: "Вторичная — рамка толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-result-secondary-btn-border-color", label: "Вторичная — рамка цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-secondary-btn-border-opacity", label: "Вторичная — рамка прозрачность", defaultValue: 0.15, ...OPACITY_RANGE },
      { key: "--ai-result-secondary-btn-active-scale", label: "Вторичная — сжатие при нажатии", defaultValue: 0.98, ...SCALE_RANGE },
    ],
  },
  {
    title: "Результат — инфо-бар",
    tokens: [
      { key: "--ai-result-info-gap", label: "Зазор иконка/текст", defaultValue: 10, ...GAP_RANGE },
      { key: "--ai-result-info-max-width", label: "Ширина", defaultValue: 520, ...BLOCK_WIDTH_RANGE },
      { key: "--ai-result-info-font-size", label: "Текст — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--ai-result-info-text-color", label: "Текст — цвет", type: "color", defaultValue: "#8b8fa3" },
      { key: "--ai-result-info-icon-size", label: "Иконка «i» — размер", defaultValue: 18, ...SIZE_RANGE },
      { key: "--ai-result-info-icon-font-size", label: "Иконка «i» — шрифт", defaultValue: 10, ...FONT_RANGE },
      { key: "--ai-result-info-icon-border-width", label: "Иконка — обводка толщина", defaultValue: 1, ...BORDER_WIDTH_RANGE },
      { key: "--ai-result-info-icon-border-color", label: "Иконка — обводка цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-info-icon-border-opacity", label: "Иконка — обводка прозрачность", defaultValue: 0.35, ...OPACITY_RANGE },
      { key: "--ai-result-info-icon-color", label: "Иконка — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--ai-result-info-icon-color-opacity", label: "Иконка — прозрачность", defaultValue: 0.75, ...OPACITY_RANGE },
    ],
  },
];

function isSectionVisible(title: string, step: AiFlowStep): boolean {
  if (title.startsWith("QR —")) return step === "qr";
  if (title.startsWith("Стиль —")) return step === "style";
  if (title.startsWith("Результат —")) return step === "result" || step === "processing";
  if (
    title === "Заголовок экрана" ||
    title === "Сетка карточек" ||
    title.startsWith("Карточка «") ||
    title === "Иконки карточек" ||
    title === "Бейдж AI" ||
    title === "Инфо-бар"
  ) {
    return step === "source";
  }
  return true;
}

const AI_COMMON_TITLES = ["Страница", "Шапка", "Кнопка «Назад»"] as const;

const AI_SOURCE_TITLES = [
  "Заголовок экрана",
  "Сетка карточек",
  "Карточка «Камера» — фон и рамка",
  "Карточка «Камера» — акценты",
  "Карточка «Телефон» — фон и рамка",
  "Карточка «Телефон» — акценты",
  "Иконки карточек",
  "Бейдж AI",
  "Инфо-бар",
] as const;

const AI_STEP_GROUPS: Array<{
  label: string;
  titles: readonly string[];
  visibleOn: AiFlowStep[];
}> = [
  {
    label: "Источник",
    titles: AI_SOURCE_TITLES,
    visibleOn: ["source"],
  },
  {
    label: "QR-загрузка",
    titles: SECTIONS.filter((section) => section.title.startsWith("QR —")).map((section) => section.title),
    visibleOn: ["qr"],
  },
  {
    label: "Выбор стиля",
    titles: SECTIONS.filter((section) => section.title.startsWith("Стиль —")).map((section) => section.title),
    visibleOn: ["style"],
  },
  {
    label: "Результат",
    titles: SECTIONS.filter((section) => section.title.startsWith("Результат —")).map((section) => section.title),
    visibleOn: ["result", "processing"],
  },
];

const ALL_TOKENS: Token[] = Array.from(
  new Map(SECTIONS.flatMap((section) => section.tokens).map((token) => [token.key, token])).values(),
);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const STORAGE_KEY = "kiosk-ai-theme-overrides-v4";
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
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("kiosk-ai-source-theme-overrides-v1");
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
 * Floating design panel for `/kiosk/ai` steps "source", "qr", "style", "processing" and "result".
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
  const { isOpen: isSectionOpen, toggle: toggleSection } = useOpenSections("ai-theme-panel-open-sections");

  const isAiThemedScreen =
    location.pathname === "/kiosk/ai" &&
    (step === "source" || step === "qr" || step === "style" || step === "processing" || step === "result");

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

  if (!isAiThemedScreen) return null;

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

          <SettingsPanelGroup label="Общие">
            {pickSectionsByTitle(SECTIONS, AI_COMMON_TITLES).map((section) => {
              const id = settingsSectionId(section.title);
              return (
                <SettingsPanelSection
                  key={section.title}
                  id={id}
                  title={section.title}
                  open={isSectionOpen(id)}
                  onToggle={() => toggleSection(id)}
                >
                  {section.tokens.map((token) => renderToken(token))}
                </SettingsPanelSection>
              );
            })}
          </SettingsPanelGroup>

          {AI_STEP_GROUPS.filter((group) => group.visibleOn.includes(step)).map((group) => {
            const sections = pickSectionsByTitle(SECTIONS, group.titles).filter((section) =>
              isSectionVisible(section.title, step),
            );
            if (sections.length === 0) return null;
            return (
              <SettingsPanelGroup key={group.label} label={group.label}>
                {sections.map((section) => {
                  const id = settingsSectionId(section.title);
                  return (
                    <SettingsPanelSection
                      key={section.title}
                      id={id}
                      title={section.title}
                      open={isSectionOpen(id)}
                      onToggle={() => toggleSection(id)}
                    >
                      {section.tokens.map((token) => renderToken(token))}
                    </SettingsPanelSection>
                  );
                })}
              </SettingsPanelGroup>
            );
          })}

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
