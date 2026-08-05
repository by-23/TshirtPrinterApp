import { useTranslation } from "react-i18next";
import { getCategorySelectLabel } from "../lib/homeLabels.js";
import { TshirtIcon } from "./icons.js";
import { homeThemeSection } from "../routes/kiosk/themeSectionsHome.js";

/** Bottom callout bar on the kiosk home screen — matches the category-select mockup. */
export function CategorySelectBanner() {
  const { i18n } = useTranslation();
  const { main, sub } = getCategorySelectLabel(i18n.language);

  return (
    <div className="category-select-banner" {...homeThemeSection("selectBanner")}>
      <TshirtIcon aria-hidden className="category-select-icon" />
      <div className="category-select-labels">
        <span className="category-select-title">{main}</span>
        <span className="category-select-subtitle">{sub}</span>
      </div>
    </div>
  );
}
