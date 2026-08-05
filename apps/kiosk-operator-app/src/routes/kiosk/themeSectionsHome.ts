import { settingsSectionId } from "../../components/settingsPanelUi.js";
import { themeSectionProps } from "../../lib/themePick.js";

export const HOME_THEME_SECTIONS = {
  pageBg: settingsSectionId("Общий фон страницы"),
  language: settingsSectionId("Переключатель языка"),
  categories: settingsSectionId("Карточки категорий"),
  selectBanner: settingsSectionId("Плашка «Выберите категорию»"),
  popular: settingsSectionId("Популярные принты"),
} as const;

export function homeThemeSection(key: keyof typeof HOME_THEME_SECTIONS) {
  return themeSectionProps(HOME_THEME_SECTIONS[key]);
}

export const HOME_THEME_PICK_ROOT = ".kiosk-home-page";
export const HOME_LANG_PICK_ROOT = ".kiosk-lang-switcher";
