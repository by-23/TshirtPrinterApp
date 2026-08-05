import { settingsSectionId } from "../../components/settingsPanelUi.js";
import { themeSectionProps } from "../../lib/themePick.js";

export const GALLERY_THEME_SECTIONS = {
  page: settingsSectionId("Отступы страницы"),
  header: settingsSectionId("Шапка"),
  search: settingsSectionId("Поиск"),
  grid: settingsSectionId("Сетка карточек"),
  loadMore: settingsSectionId("Карточка «Загрузка ещё»"),
  cardColors: settingsSectionId("Цвета рамок карточек (циклом по порядку)"),
} as const;

export function galleryThemeSection(key: keyof typeof GALLERY_THEME_SECTIONS) {
  return themeSectionProps(GALLERY_THEME_SECTIONS[key]);
}
