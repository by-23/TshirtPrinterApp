import type { CSSProperties } from "react";
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

function buttonStyle(isActive: boolean): CSSProperties {
  return {
    width: "var(--kiosk-lang-btn-width)",
    height: "var(--kiosk-lang-btn-height)",
    borderRadius: "var(--kiosk-lang-btn-radius)",
    fontSize: "var(--kiosk-lang-btn-font-size)",
    transform: isActive ? "scale(var(--kiosk-lang-btn-active-scale))" : undefined,
    backgroundColor: isActive ? "var(--kiosk-lang-btn-active-bg)" : "var(--kiosk-lang-btn-idle-bg)",
    borderWidth: isActive ? 0 : "1px",
    borderStyle: "solid",
    borderColor: isActive ? "transparent" : "var(--kiosk-lang-btn-idle-border)",
    color: isActive ? "#ffffff" : "var(--kiosk-lang-btn-idle-text)",
    boxShadow: isActive ? "var(--brand-pill-glow)" : undefined,
  };
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  return (
    <div className={`flex ${className}`} style={{ gap: "var(--kiosk-lang-btn-gap)" }}>
      {supportedLanguages.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={isActive}
            onClick={() => void i18n.changeLanguage(lang)}
            style={buttonStyle(isActive)}
            className="inline-flex items-center justify-center font-bold uppercase tracking-wide transition-all"
          >
            {NATIVE_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
