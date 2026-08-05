import { settingsSectionId } from "../components/settingsPanelUi.js";
import { themeSectionProps } from "../lib/themePick.js";

/** Stable design-panel section ids for editor page regions. */
export const EDITOR_THEME_SECTIONS = {
  pageBg: settingsSectionId("Общий фон страницы"),
  header: settingsSectionId("Шапка"),
  printSide: settingsSectionId("Переключатель стороны печати"),
  rail: settingsSectionId("Левая панель инструментов"),
  toolPopovers: settingsSectionId("Панели инструментов"),
  canvasCard: settingsSectionId("Карточка холста"),
  controlStrip: settingsSectionId("Полоска управления объектом"),
  objectControls: settingsSectionId("Плавающие кнопки объекта"),
  rightPanel: settingsSectionId("Правая панель"),
  color: settingsSectionId("Цвет изделия (плитки)"),
  size: settingsSectionId("Размер (кнопки)"),
  fabric: settingsSectionId("Материал (кнопки)"),
  preview: settingsSectionId("Кнопка «Предпросмотр»"),
  price: settingsSectionId("Цена и печать"),
  orderNote: settingsSectionId("«Заказ сохраняется после оплаты» (сноска)"),
  popular: settingsSectionId("Популярные элементы"),
  tips: settingsSectionId("Советы"),
} as const;

export function editorThemeSection(key: keyof typeof EDITOR_THEME_SECTIONS) {
  return themeSectionProps(EDITOR_THEME_SECTIONS[key]);
}
