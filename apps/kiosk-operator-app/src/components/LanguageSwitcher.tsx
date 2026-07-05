import { useTranslation } from "react-i18next";
import { supportedLanguages, type SupportedLanguage } from "@tshirt/i18n";

export interface LanguageSwitcherProps {
  className?: string;
  /** When true, reads `--editor-lang-*` tokens instead of global brand styles. */
  editor?: boolean;
}

// Each pill always shows the language's own native short name (РУС/ҚАЗ/ENG/中文),
// regardless of the currently active UI language — matching the reference mockup.
const NATIVE_LABELS: Record<SupportedLanguage, string> = {
  ru: "РУС",
  kk: "ҚАЗ",
  en: "ENG",
  zh: "中文",
};

export function LanguageSwitcher({ className = "", editor = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  return (
    <div className={`flex ${className}`} style={editor ? { gap: "var(--editor-lang-btn-gap)" } : { gap: "10px" }}>
      {supportedLanguages.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            aria-pressed={isActive}
            onClick={() => void i18n.changeLanguage(lang)}
            style={
              editor
                ? {
                    width: "var(--editor-lang-btn-width)",
                    height: "var(--editor-lang-btn-height)",
                    borderRadius: "var(--editor-lang-btn-radius)",
                    fontSize: "var(--editor-lang-btn-font-size)",
                    transform: isActive ? "scale(var(--editor-lang-btn-active-scale))" : undefined,
                    backgroundColor: isActive ? "var(--editor-lang-btn-active-bg)" : "var(--editor-lang-btn-idle-bg)",
                    borderWidth: isActive ? 0 : "1px",
                    borderStyle: "solid",
                    borderColor: isActive ? "transparent" : "var(--editor-lang-btn-idle-border)",
                    color: isActive ? "#ffffff" : "var(--editor-lang-btn-idle-text)",
                    boxShadow: isActive ? "var(--brand-pill-glow)" : undefined,
                  }
                : isActive
                  ? { backgroundColor: "var(--brand-primary)", boxShadow: "var(--brand-pill-glow)" }
                  : undefined
            }
            className={
              editor
                ? "inline-flex items-center justify-center font-bold uppercase tracking-wide transition-all"
                : `min-w-[74px] rounded-pill px-4 py-2.5 text-[15px] font-bold uppercase tracking-wide transition-all ${
                    isActive ? "scale-110 text-white" : "border border-ink-600 bg-ink-800 text-ink-300"
                  }`
            }
          >
            {NATIVE_LABELS[lang]}
          </button>
        );
      })}
    </div>
  );
}
