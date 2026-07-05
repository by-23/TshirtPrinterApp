import { Banner } from "../../components/Banner.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { CategoryGrid } from "../../components/CategoryGrid.js";
import { CategorySelectBanner } from "../../components/CategorySelectBanner.js";

export function KioskHome() {
  return (
    <div
      className="kiosk-theme-root flex h-full w-full flex-col overflow-hidden px-10 pb-12 pt-12 text-white"
      style={{ backgroundColor: "var(--kiosk-page-bg)" }}
    >
      <div className="mb-10 flex justify-end" aria-hidden>
        <LanguageSwitcherSlot />
      </div>

      <Banner />

      <div className="mt-14 flex flex-col gap-8">
        <CategoryGrid />
        <CategorySelectBanner />
      </div>
    </div>
  );
}
