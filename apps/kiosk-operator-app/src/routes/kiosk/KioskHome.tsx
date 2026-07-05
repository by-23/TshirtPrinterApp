import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/LanguageSwitcher.js";
import { Banner } from "../../components/Banner.js";
import { CategoryGrid } from "../../components/CategoryGrid.js";
import { PointServerStatus } from "../../components/PointServerStatus.js";

export function KioskHome() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-ink-950 p-6 text-white">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-wide sm:text-3xl">{t("common.appTitle")}</h1>
        <LanguageSwitcher withLabel />
      </header>

      <Banner />

      <CategoryGrid />

      <div className="mt-2 flex items-center justify-center gap-3 rounded-full border border-neon-pink/60 bg-ink-900 px-6 py-3 text-center shadow-neon-pink">
        <span className="text-xl" aria-hidden>
          👕
        </span>
        <span className="text-base font-bold uppercase tracking-wide text-neon-pink sm:text-lg">
          {t("home.categorySelect")}
        </span>
      </div>

      <footer className="mt-auto flex justify-center pt-4">
        <PointServerStatus />
      </footer>
    </div>
  );
}