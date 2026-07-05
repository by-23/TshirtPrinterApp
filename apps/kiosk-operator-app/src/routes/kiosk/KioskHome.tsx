import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/LanguageSwitcher.js";
import { Banner } from "../../components/Banner.js";
import { CategoryGrid } from "../../components/CategoryGrid.js";
import { PointServerStatus } from "../../components/PointServerStatus.js";

export function KioskHome() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-white p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("common.appTitle")}</h1>
        <LanguageSwitcher />
      </header>

      <Banner />

      <CategoryGrid />

      <footer className="mt-auto flex justify-center pt-6">
        <PointServerStatus />
      </footer>
    </div>
  );
}
