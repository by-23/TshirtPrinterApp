import { Banner } from "../../components/Banner.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { CategoryGrid } from "../../components/CategoryGrid.js";
import { CategorySelectBanner } from "../../components/CategorySelectBanner.js";
import { homeThemeSection } from "./themeSectionsHome.js";

export function KioskHome() {
  return (
    <div
      // Background intentionally left transparent: KioskAmbientBackdrop
      // (mounted in KioskShell, behind this page) paints the page color and
      // the frosted glow layer — this div just lets that show through.
      className="kiosk-theme-root kiosk-home-page flex h-full w-full flex-col overflow-hidden px-10 pb-12 pt-12 text-white"
      {...homeThemeSection("pageBg")}
    >
      <div className="mb-10 flex justify-end" aria-hidden>
        <LanguageSwitcherSlot />
      </div>

      <Banner />

      <div className="flex flex-col gap-8">
        <CategoryGrid />
        <CategorySelectBanner />
      </div>
    </div>
  );
}
