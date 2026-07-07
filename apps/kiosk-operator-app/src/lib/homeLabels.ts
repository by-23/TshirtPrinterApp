import type { DesignCategory } from "@tshirt/shared-types";
import { supportedLanguages, type SupportedLanguage } from "@tshirt/i18n";
import { i18next } from "./i18n.js";

const CATEGORY_I18N_KEY: Record<DesignCategory, string> = {
  memes: "home.categories.memes",
  anime_movies: "home.categories.animeMovies",
  games: "home.categories.games",
  text: "home.categories.text",
  custom: "home.categories.custom",
  ai_style: "home.categories.aiStyle",
};

function normalizeLanguage(lng: string): SupportedLanguage {
  const base = lng.split("-")[0] as SupportedLanguage;
  return supportedLanguages.includes(base) ? base : "ru";
}

function translate(key: string, lng: SupportedLanguage): string {
  return i18next.t(key, { lng });
}

function buildMainSubLabels(
  key: string,
  activeLang: SupportedLanguage,
): { main: string; sub: string } {
  const main = translate(key, activeLang);
  const sub = supportedLanguages
    .filter((lang) => lang !== activeLang)
    .map((lang) => translate(key, lang))
    .join(" / ");
  return { main, sub };
}

export function getCategoryHomeLabel(
  category: DesignCategory,
  lng: string,
): { main: string; sub: string } {
  return buildMainSubLabels(CATEGORY_I18N_KEY[category], normalizeLanguage(lng));
}

export function getCategorySelectLabel(lng: string): { main: string; sub: string } {
  return buildMainSubLabels("home.categorySelect", normalizeLanguage(lng));
}

export function getBannerTitle(lng: string): string {
  return translate("home.banner.title", normalizeLanguage(lng));
}
