import { useEffect, useState, useRef } from "react";
import { GripVertical, SlidersHorizontal } from "./icons.js";
import {
  SettingsPanelGroup,
  SettingsPanelSection,
  pickSectionsByTitle,
  settingsSectionId,
  useOpenSections,
} from "./settingsPanelUi.js";
import { useDraggablePanel } from "../lib/useDraggablePanel.js";
import { OPERATOR_SCROLL_CSS_VARS, syncAllOperatorScrollElements } from "../lib/operatorScrollTheme.js";

import {
  clearThemeOverrideStorage,
  createThemeCssSaver,
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

const FONT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 8, max: 64, step: 1, unit: "px" };
const SIZE_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 12, max: 400, step: 1, unit: "px" };
const GAP_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 0, max: 40, step: 1, unit: "px" };
const PADDING_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 0, max: 64, step: 1, unit: "px" };
const RADIUS_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 0, max: 60, step: 1, unit: "px" };
const RADIUS_FULL: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 0, max: 999, step: 1, unit: "px" };
const WIDTH_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step" | "unit"> = { type: "range", min: 160, max: 800, step: 1, unit: "px" };
const COUNT_RANGE: Pick<RangeToken, "type" | "min" | "max" | "step"> = { type: "range", min: 2, max: 8, step: 1 };

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

const COLUMNS_OPTIONS = [
  { label: "1.2 : 1", value: "1.2fr 1fr" },
  { label: "1 : 1", value: "1fr 1fr" },
  { label: "1.5 : 1", value: "1.5fr 1fr" },
  { label: "2 : 1", value: "2fr 1fr" },
  { label: "1 : 1.2", value: "1fr 1.2fr" },
];

/**
 * Every tunable operator-screen token, grouped the same way as the panel's
 * UI and matching the order the blocks appear on `docs/ui-mockups/operator.png`.
 * Values here MUST match the defaults declared in `index.css` — this is the
 * single list the panel reads/writes, and what "Сброс" restores.
 */
const SECTIONS: Section[] = [
  {
    title: "Общая палитра",
    tokens: [
      { key: "--operator-page-bg", label: "Фон страницы", type: "color", defaultValue: "#05060a" },
      { key: "--operator-sidebar-bg", label: "Фон сайдбара", type: "color", defaultValue: "#0b0d16" },
      { key: "--operator-card-bg", label: "Фон карточек", type: "color", defaultValue: "#12141f" },
      { key: "--operator-card-border", label: "Обводка карточек", type: "color", defaultValue: "#232538" },
      { key: "--operator-accent", label: "Акцентный цвет", type: "color", defaultValue: "#ff2d78" },
      { key: "--operator-text-muted", label: "Приглушённый текст", type: "color", defaultValue: "#8b8fa3" },
    ],
  },
  {
    title: "Скроллбары",
    tokens: [
      { key: "--operator-scroll-size", label: "Толщина", defaultValue: 4, ...SCROLL_SIZE_RANGE },
      { key: "--operator-scroll-track-color", label: "Дорожка — цвет", type: "color", defaultValue: "#232538" },
      { key: "--operator-scroll-track-opacity", label: "Дорожка — прозрачность", defaultValue: 0.5, ...OPACITY_RANGE },
      { key: "--operator-scroll-thumb-color", label: "Ползунок — цвет", type: "color", defaultValue: "#5b6690" },
      { key: "--operator-scroll-thumb-opacity", label: "Ползунок — прозрачность", defaultValue: 0.85, ...OPACITY_RANGE },
    ],
  },
  {
    title: "Сайдбар — размер и шапка",
    tokens: [
      { key: "--operator-sidebar-width", label: "Ширина сайдбара", defaultValue: 256, ...WIDTH_RANGE },
      { key: "--operator-sidebar-header-padding-x", label: "Шапка — отступ X", defaultValue: 28, ...PADDING_RANGE },
      { key: "--operator-sidebar-header-padding-y", label: "Шапка — отступ Y", defaultValue: 28, ...PADDING_RANGE },
      { key: "--operator-sidebar-header-gap", label: "Шапка — зазор строк", defaultValue: 4, ...GAP_RANGE },
      { key: "--operator-sidebar-logo-size", label: "Лого — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--operator-sidebar-logo-color", label: "Лого — цвет", type: "color", defaultValue: "#ffffff" },
      { key: "--operator-sidebar-subtitle-size", label: "Подпись «Оператор» — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-sidebar-subtitle-color", label: "Подпись «Оператор» — цвет", type: "color", defaultValue: "#ff2d78" },
    ],
  },
  {
    title: "Сайдбар — навигация",
    tokens: [
      { key: "--operator-sidebar-nav-padding-x", label: "Меню — отступ по X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-sidebar-nav-item-gap", label: "Меню — зазор между пунктами", defaultValue: 6, ...GAP_RANGE },
      { key: "--operator-sidebar-nav-item-padding-x", label: "Пункт — отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-sidebar-nav-item-padding-y", label: "Пункт — отступ Y", defaultValue: 14, ...PADDING_RANGE },
      { key: "--operator-sidebar-nav-item-radius", label: "Пункт — скругление", defaultValue: 12, ...RADIUS_RANGE },
      { key: "--operator-sidebar-nav-icon-gap", label: "Пункт — зазор иконка/текст", defaultValue: 14, ...GAP_RANGE },
      { key: "--operator-sidebar-nav-font-size", label: "Пункт — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-sidebar-nav-icon-size", label: "Пункт — иконка", defaultValue: 24, ...SIZE_RANGE, min: 12, max: 48 },
      { key: "--operator-sidebar-nav-active-color", label: "Активный пункт — цвет", type: "color", defaultValue: "#ff2d78" },
      { key: "--operator-sidebar-nav-idle-color", label: "Неактивный пункт — цвет", type: "color", defaultValue: "#8b8fa3" },
    ],
  },
  {
    title: "Сайдбар — профиль",
    tokens: [
      { key: "--operator-sidebar-footer-padding-x", label: "Блок — отступ X", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-sidebar-footer-padding-y", label: "Блок — отступ Y", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-sidebar-footer-gap", label: "Блок — зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--operator-sidebar-avatar-size", label: "Аватар — размер", defaultValue: 44, ...SIZE_RANGE, min: 24, max: 96 },
      { key: "--operator-sidebar-avatar-font-size", label: "Аватар — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-sidebar-avatar-color", label: "Аватар — цвет текста", type: "color", defaultValue: "#ff2d78" },
      { key: "--operator-sidebar-name-size", label: "Имя — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-sidebar-role-size", label: "Роль — размер", defaultValue: 14, ...FONT_RANGE },
    ],
  },
  {
    title: "Панель статистики (шапка)",
    tokens: [
      { key: "--operator-statsbar-padding-x", label: "Шапка — отступ X", defaultValue: 32, ...PADDING_RANGE },
      { key: "--operator-statsbar-padding-y", label: "Шапка — отступ Y", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-statsbar-gap", label: "Зазор между блоками", defaultValue: 16, ...GAP_RANGE },
      { key: "--operator-statsbar-pill-font-size", label: "Плашка «Заказы» — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-statsbar-pill-padding-x", label: "Плашка «Заказы» — отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-statsbar-pill-padding-y", label: "Плашка «Заказы» — отступ Y", defaultValue: 8, ...PADDING_RANGE },
      { key: "--operator-statsbar-badge-size", label: "Счётчик — размер", defaultValue: 24, ...SIZE_RANGE, min: 12, max: 48 },
      { key: "--operator-statsbar-badge-font-size", label: "Счётчик — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-statsbar-card-padding-x", label: "Карточка — отступ X", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-statsbar-card-padding-y", label: "Карточка — отступ Y", defaultValue: 10, ...PADDING_RANGE },
      { key: "--operator-statsbar-card-value-size", label: "Карточка — цифра", defaultValue: 24, ...FONT_RANGE },
      { key: "--operator-statsbar-card-label-size", label: "Карточка — подпись", defaultValue: 12, ...FONT_RANGE },
      { key: "--operator-statsbar-printer-font-size", label: "«Принтер готов» — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-statsbar-printer-icon-size", label: "«Принтер готов» — иконка", defaultValue: 20, ...SIZE_RANGE, min: 12, max: 48 },
      { key: "--operator-statsbar-printer-padding-x", label: "«Принтер готов» — отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-statsbar-printer-padding-y", label: "«Принтер готов» — отступ Y", defaultValue: 8, ...PADDING_RANGE },
      { key: "--operator-statsbar-printer-color", label: "«Принтер готов» — цвет", type: "color", defaultValue: "#2ecc71" },
    ],
  },
  {
    title: "Лента заказов — список",
    tokens: [
      { key: "--operator-list-width", label: "Ширина колонки", defaultValue: 384, ...WIDTH_RANGE, min: 240 },
      { key: "--operator-list-header-padding-x", label: "Шапка — отступ X", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-list-header-padding-top", label: "Шапка — отступ сверху", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-list-header-padding-bottom", label: "Шапка — отступ снизу", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-list-title-size", label: "Заголовок — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-list-search-height", label: "Поиск — высота", defaultValue: 44, ...SIZE_RANGE, min: 24, max: 72 },
      { key: "--operator-list-search-font-size", label: "Поиск — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-list-search-radius", label: "Поиск — скругление", defaultValue: 8, ...RADIUS_RANGE },
      { key: "--operator-list-items-padding-x", label: "Список — отступ X", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-list-item-gap", label: "Список — зазор карточек", defaultValue: 6, ...GAP_RANGE },
      { key: "--operator-list-footer-font-size", label: "Футер — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-list-footer-padding-x", label: "Футер — отступ X", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-list-footer-padding-y", label: "Футер — отступ Y", defaultValue: 12, ...PADDING_RANGE },
    ],
  },
  {
    title: "Лента заказов — карточка",
    tokens: [
      { key: "--operator-item-padding-x", label: "Карточка — отступ X", defaultValue: 14, ...PADDING_RANGE },
      { key: "--operator-item-padding-y", label: "Карточка — отступ Y", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-item-radius", label: "Карточка — скругление", defaultValue: 12, ...RADIUS_RANGE },
      { key: "--operator-item-content-gap", label: "Карточка — зазор фото/текст", defaultValue: 14, ...GAP_RANGE },
      { key: "--operator-item-thumb-size", label: "Превью — размер", defaultValue: 64, ...SIZE_RANGE, min: 32, max: 160 },
      { key: "--operator-item-thumb-radius", label: "Превью — скругление", defaultValue: 8, ...RADIUS_RANGE },
      { key: "--operator-item-thumb-icon-size", label: "Превью — иконка-заглушка", defaultValue: 28, ...SIZE_RANGE, min: 12, max: 64 },
      { key: "--operator-item-number-size", label: "Номер заказа — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-item-time-size", label: "Время — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-item-detail-size", label: "Строка описания — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-item-price-size", label: "Цена — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-badge-font-size", label: "Бейдж статуса — текст", defaultValue: 12, ...FONT_RANGE },
      { key: "--operator-badge-padding-x", label: "Бейдж статуса — отступ X", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-badge-padding-y", label: "Бейдж статуса — отступ Y", defaultValue: 6, ...PADDING_RANGE },
      { key: "--operator-badge-radius", label: "Бейдж статуса — скругление", defaultValue: 999, ...RADIUS_FULL },
    ],
  },
  {
    title: "Детали заказа — макет",
    tokens: [
      { key: "--operator-details-padding-x", label: "Колонка — отступ X", defaultValue: 32, ...PADDING_RANGE },
      { key: "--operator-details-padding-y", label: "Колонка — отступ Y", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-details-columns", label: "Соотношение колонок", type: "select", defaultValue: "1.2fr 1fr", options: COLUMNS_OPTIONS },
      { key: "--operator-details-columns-gap", label: "Зазор между колонками", defaultValue: 20, ...GAP_RANGE },
      { key: "--operator-details-title-size", label: "Заголовок «Заказ №» — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--operator-details-meta-size", label: "Дата/время — размер", defaultValue: 14, ...FONT_RANGE },
    ],
  },
  {
    title: "Детали заказа — превью мокапа",
    tokens: [
      { key: "--operator-details-side-font-size", label: "Переключатель стороны — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-details-side-padding-x", label: "Переключатель стороны — отступ X", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-details-side-padding-y", label: "Переключатель стороны — отступ Y", defaultValue: 8, ...PADDING_RANGE },
      { key: "--operator-details-preview-radius", label: "Блок превью — скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--operator-details-preview-padding-y", label: "Блок превью — отступ Y", defaultValue: 24, ...PADDING_RANGE },
      { key: "--operator-details-preview-max-height", label: "Мокап — макс. высота", defaultValue: 320, ...SIZE_RANGE, min: 120, max: 640 },
    ],
  },
  {
    title: "Детали заказа — карточки справа",
    tokens: [
      { key: "--operator-details-card-padding", label: "Карточка — отступ", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-details-card-radius", label: "Карточка — скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--operator-details-card-heading-size", label: "Заголовок карточки — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-details-row-font-size", label: "Строка «Детали заказа» — размер", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-details-design-thumb-size", label: "Превью дизайна — размер", defaultValue: 80, ...SIZE_RANGE, min: 32, max: 200 },
      { key: "--operator-details-design-thumb-radius", label: "Превью дизайна — скругление", defaultValue: 8, ...RADIUS_RANGE },
    ],
  },
  {
    title: "Детали заказа — кнопки действий",
    tokens: [
      { key: "--operator-details-button-font-size", label: "Кнопки — текст", defaultValue: 16, ...FONT_RANGE },
      { key: "--operator-details-button-padding-y", label: "Кнопки — отступ Y", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-details-button-radius", label: "Кнопки — скругление", defaultValue: 12, ...RADIUS_RANGE },
      { key: "--operator-details-buttons-gap", label: "Кнопки — зазор", defaultValue: 12, ...GAP_RANGE },
      { key: "--operator-details-accept-bg", label: "«Отправить на печать» — фон", type: "color", defaultValue: "#ff2d78" },
      { key: "--operator-details-done-bg", label: "«Готово» — фон", type: "color", defaultValue: "#2ecc71" },
      { key: "--operator-details-cancel-color", label: "«Отменить заказ» — цвет текста", type: "color", defaultValue: "#ff6b6b" },
    ],
  },
  {
    title: "Панель принтера",
    tokens: [
      { key: "--operator-printer-width", label: "Ширина панели", defaultValue: 320, ...WIDTH_RANGE, min: 200, max: 560 },
      { key: "--operator-printer-padding-x", label: "Панель — отступ X", defaultValue: 16, ...PADDING_RANGE },
      { key: "--operator-printer-padding-y", label: "Панель — отступ Y (верх)", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-printer-padding-bottom", label: "Панель — отступ снизу", defaultValue: 24, ...PADDING_RANGE },
      { key: "--operator-printer-section-gap", label: "Зазор между блоками", defaultValue: 6, ...GAP_RANGE },
      { key: "--operator-printer-section-padding", label: "Блок — внутренний отступ", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-printer-inner-gap", label: "Блок — зазор между строками", defaultValue: 7, ...GAP_RANGE },
      { key: "--operator-printer-section-radius", label: "Блок — скругление", defaultValue: 16, ...RADIUS_RANGE },
      { key: "--operator-printer-heading-size", label: "Заголовок блока — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-printer-status-size", label: "«Готов к печати» — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--operator-printer-icon-box-size", label: "Иконка принтера — рамка", defaultValue: 48, ...SIZE_RANGE, min: 32, max: 160 },
      { key: "--operator-printer-icon-size", label: "Иконка принтера — размер", defaultValue: 26, ...SIZE_RANGE, min: 12, max: 96 },
      { key: "--operator-printer-name-size", label: "Название модели — размер", defaultValue: 15, ...FONT_RANGE },
      { key: "--operator-printer-ready-color", label: "Цвет «готов/онлайн»", type: "color", defaultValue: "#2ecc71" },
    ],
  },
  {
    title: "Панель принтера — чернила и настройки",
    tokens: [
      { key: "--operator-printer-ink-label-size", label: "«Чернила» — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--operator-printer-ink-circle-size", label: "Индикатор чернил — размер", defaultValue: 32, ...SIZE_RANGE, min: 16, max: 96 },
      { key: "--operator-printer-ink-icon-size", label: "Индикатор чернил — иконка", defaultValue: 14, ...SIZE_RANGE, min: 8, max: 48 },
      { key: "--operator-printer-ink-value-size", label: "Индикатор чернил — «100%»", defaultValue: 11, ...FONT_RANGE },
      { key: "--operator-printer-row-font-size", label: "Строки/подписи — размер", defaultValue: 13, ...FONT_RANGE },
      { key: "--operator-printer-button-font-size", label: "Кнопки — текст", defaultValue: 13, ...FONT_RANGE },
      { key: "--operator-printer-button-padding-y", label: "Кнопки — отступ Y", defaultValue: 6, ...PADDING_RANGE },
      { key: "--operator-printer-button-radius", label: "Кнопки — скругление", defaultValue: 10, ...RADIUS_RANGE },
      { key: "--operator-printer-select-font-size", label: "Выпадающие списки — текст", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-printer-select-padding-x", label: "Выпадающие списки — отступ X", defaultValue: 10, ...PADDING_RANGE },
      { key: "--operator-printer-select-padding-y", label: "Выпадающие списки — отступ Y", defaultValue: 5, ...PADDING_RANGE },
      { key: "--operator-printer-toggle-width", label: "Переключатель — ширина", defaultValue: 44, ...SIZE_RANGE, min: 24, max: 96 },
      { key: "--operator-printer-toggle-height", label: "Переключатель — высота", defaultValue: 24, ...SIZE_RANGE, min: 12, max: 64 },
      { key: "--operator-printer-footer-font-size", label: "Нижняя статистика — размер", defaultValue: 12, ...FONT_RANGE },
    ],
  },
  {
    title: "Каталог дизайнов",
    tokens: [
      { key: "--operator-designs-padding-x", label: "Панель — отступ X", defaultValue: 32, ...PADDING_RANGE },
      { key: "--operator-designs-padding-y", label: "Панель — отступ Y", defaultValue: 20, ...PADDING_RANGE },
      { key: "--operator-designs-title-size", label: "Заголовок — размер", defaultValue: 24, ...FONT_RANGE },
      { key: "--operator-designs-columns", label: "Число колонок сетки", defaultValue: 5, ...COUNT_RANGE },
      { key: "--operator-designs-gap", label: "Зазор карточек", defaultValue: 16, ...GAP_RANGE },
      { key: "--operator-designs-card-radius", label: "Карточка — скругление", defaultValue: 12, ...RADIUS_RANGE },
      { key: "--operator-designs-card-padding", label: "Карточка — внутренний отступ", defaultValue: 12, ...PADDING_RANGE },
      { key: "--operator-designs-card-title-size", label: "Название дизайна — размер", defaultValue: 14, ...FONT_RANGE },
      { key: "--operator-designs-card-category-size", label: "Категория — размер", defaultValue: 12, ...FONT_RANGE },
      { key: "--operator-designs-icon-size", label: "Иконка-заглушка — размер", defaultValue: 36, ...SIZE_RANGE, min: 16, max: 96 },
    ],
  },
];

const PANEL_GROUPS: Array<{ label: string; titles: readonly string[] }> = [
  {
    label: "Основные",
    titles: ["Общая палитра", "Скроллбары"],
  },
  {
    label: "Сайдбар",
    titles: ["Сайдбар — размер и шапка", "Сайдбар — навигация", "Сайдбар — профиль"],
  },
  {
    label: "Заказы",
    titles: [
      "Панель статистики (шапка)",
      "Лента заказов — список",
      "Лента заказов — карточка",
      "Детали заказа — макет",
      "Детали заказа — превью мокапа",
      "Детали заказа — карточки справа",
      "Детали заказа — кнопки действий",
    ],
  },
  {
    label: "Принтер",
    titles: ["Панель принтера", "Панель принтера — чернила и настройки"],
  },
  {
    label: "Каталог",
    titles: ["Каталог дизайнов"],
  },
];

const ALL_TOKENS: Token[] = SECTIONS.flatMap((section) => section.tokens);
const TOKEN_BY_KEY = new Map(ALL_TOKENS.map((token) => [token.key, token]));
const SCOPE_SELECTOR = ".operator-theme-root";

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
  const scope = document.querySelector(SCOPE_SELECTOR);
  const source = scope instanceof HTMLElement ? scope : document.documentElement;
  const raw = getComputedStyle(source).getPropertyValue(token.key).trim();
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
  const operatorRoot = document.querySelector(SCOPE_SELECTOR);
  if (operatorRoot instanceof HTMLElement) {
    operatorRoot.style.setProperty(key, cssValue);
    if (OPERATOR_SCROLL_CSS_VARS.includes(key as (typeof OPERATOR_SCROLL_CSS_VARS)[number])) {
      syncAllOperatorScrollElements(operatorRoot);
    }
  }
}

function clearToken(key: string) {
  document.documentElement.style.removeProperty(key);
  const operatorRoot = document.querySelector(SCOPE_SELECTOR);
  if (operatorRoot instanceof HTMLElement) {
    operatorRoot.style.removeProperty(key);
    if (OPERATOR_SCROLL_CSS_VARS.includes(key as (typeof OPERATOR_SCROLL_CSS_VARS)[number])) {
      syncAllOperatorScrollElements(operatorRoot);
    }
  }
}

/**
 * Floating design panel — every change writes CSS tokens into index.css (dev only).
 */
export function OperatorThemePanel() {
  const [open, setOpen] = useState(false);
  const { containerRef, style: dragStyle, dragHandleProps } = useDraggablePanel("operator-theme-panel-position");
  const [values, setValues] = useState<Record<string, string>>(() => getBaselineValues());
  const [saveState, setSaveState] = useState<ThemeSaveState>("idle");
  const saverRef = useRef(createThemeCssSaver({ onState: setSaveState }));

  useEffect(() => {
    clearThemeOverrideStorage();
    const saver = saverRef.current;
    return () => saver.dispose();
  }, []);
  const { isOpen: isSectionOpen, toggle: toggleSection } = useOpenSections("operator-theme-panel-open-sections");

  useEffect(() => {
    function applyAll() {
      for (const [key, value] of Object.entries(values)) {
        applyValue(key, value);
      }
      const operatorRoot = document.querySelector(SCOPE_SELECTOR);
      if (operatorRoot instanceof HTMLElement) {
        syncAllOperatorScrollElements(operatorRoot);
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
        <span className="min-w-[260px] text-white/80">{token.label}</span>
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
              className="h-3 flex-1 cursor-pointer accent-[var(--operator-accent)]"
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
    <div ref={containerRef} className="fixed right-6 top-6 z-50 flex flex-col items-end gap-5" style={dragStyle}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Настройки оформления экрана оператора"
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/10 bg-[#12142099] text-white shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition-transform hover:scale-105 active:scale-95"
      >
        <SlidersHorizontal aria-hidden className="h-8 w-8" strokeWidth={1.7} />
      </button>

      {open ? (
        <div className="settings-panel-scroll flex max-h-[85vh] w-[760px] flex-col gap-6 overflow-y-auto rounded-3xl border-2 border-white/10 bg-[#0c0e17f0] p-8 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur">
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
              <span className="text-2xl font-bold uppercase tracking-wide text-white/90">Настройки экрана оператора</span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border-2 border-white/15 px-5 py-2.5 text-base font-semibold uppercase tracking-wide text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Сброс
            </button>
          </div>

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
