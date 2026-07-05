import { useTranslation } from "react-i18next";
import { supportedLanguages } from "@tshirt/i18n";
import { PillButton } from "@tshirt/ui-kit";

export interface LanguageSwitcherProps {
  /** Show the "Choose language" caption to the left of the pills (home screen only). */
  withLabel?: boolean;
}

export function LanguageSwitcher({ withLabel = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      {withLabel && (
        <span className="hidden text-xs font-semibold uppercase tracking-wide text-ink-200 sm:inline">
          {t("home.chooseLanguage")}
        </span>
      )}
      <div className="flex gap-2">
        {supportedLanguages.map((lang) => {
          const isActive = i18n.language === lang;
          return (
            <PillButton
              key={lang}
              onClick={() => void i18n.changeLanguage(lang)}
              active={isActive}
              className="px-3 py-1.5"
            >
              {t(`language.${lang}`)}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
