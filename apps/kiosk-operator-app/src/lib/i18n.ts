import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { resources, supportedLanguages, type SupportedLanguage } from "@tshirt/i18n";

const STORAGE_KEY = "tshirt.language";

function readStoredLanguage(): SupportedLanguage | undefined {
  const stored = localStorage.getItem(STORAGE_KEY);
  return supportedLanguages.includes(stored as SupportedLanguage)
    ? (stored as SupportedLanguage)
    : undefined;
}

void i18next.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage() ?? "ru",
  fallbackLng: "ru",
  interpolation: { escapeValue: false },
});

i18next.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export { i18next };
