import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@tshirt/i18n";
import { TouchButton } from "@tshirt/ui-kit";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex gap-2">
      {supportedLanguages.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <TouchButton
            key={lang}
            onClick={() => void i18n.changeLanguage(lang)}
            aria-pressed={isActive}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t(`language.${lang}`)}
          </TouchButton>
        );
      })}
    </div>
  );
}
