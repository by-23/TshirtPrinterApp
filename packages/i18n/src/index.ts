import ru from "./locales/ru.json";
import kk from "./locales/kk.json";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const supportedLanguages = ["ru", "kk", "en", "zh"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = { ru, kk, en, zh } satisfies Record<
  SupportedLanguage,
  Record<string, unknown>
>;
