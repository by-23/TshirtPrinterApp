import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLanguage } from "@tshirt/i18n";

export interface LanguageSwitcherProps {
  className?: string;
}

// Each pill always shows the language's own native short name (РУС/ҚАЗ/ENG/中文),
// regardless of the currently active UI language — matching the reference mockup.
const NATIVE_LABELS: Record<SupportedLanguage, string> = {
  ru: "РУС",
  kk: "ҚАЗ",
  en: "ENG",
  zh: "中文",
};

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  return (
    <div className={`flex gap-2.5 ${className}`}>
      {supportedLanguages.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={isActive}
            onClick={() => void i18n.changeLanguage(lang)}
            style={
              isActive
                ? { backgroundColor: "var(--brand-primary)", boxShadow: "var(--brand-pill-glow)" }
                : undefined
            }
            className={`min-w-[74px] rounded-pill px-4 py-2.5 text-[15px] font-bold uppercase tracking-wide transition-all ${
              isActive ? "scale-110 text-white" : "border border-ink-600 bg-ink-800 text-ink-300"
            }`}
          >
            {NATIVE_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
