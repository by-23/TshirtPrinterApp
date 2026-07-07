import { useTranslation } from "react-i18next";
import { Lock } from "../../components/icons.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";

/**
 * Full-screen block shown instead of the kiosk's normal routes whenever the
 * point's synced status is `"closed"` (Этап 7 — admin toggles this from the
 * central-relay admin panel's `PointsPage`). No way to reach the editor or
 * checkout from here; only the language switcher stays available.
 */
export function ClosedScreen() {
  const { t } = useTranslation();

  return (
    <div
      className="kiosk-theme-root relative flex h-full w-full flex-col items-center justify-center gap-8 px-16 text-center text-white"
      style={{ backgroundColor: "var(--kiosk-page-bg, #05060f)" }}
    >
      <div className="absolute right-0 top-0 p-10" aria-hidden>
        <LanguageSwitcherSlot />
      </div>

      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/5">
        <Lock className="h-14 w-14 text-white/70" strokeWidth={1.5} />
      </div>

      <h1 className="text-4xl font-bold uppercase tracking-wide">{t("closed.title")}</h1>
      <p className="max-w-xl text-lg text-white/60">{t("closed.subtitle")}</p>
    </div>
  );
}
