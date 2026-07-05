import { HOME_STATIC_LABELS } from "../lib/homeLabels.js";
import { TshirtIcon } from "./icons.js";

/** Bottom callout bar on the kiosk home screen — matches the category-select mockup. */
export function CategorySelectBanner() {
  const { main, sub } = HOME_STATIC_LABELS.categorySelect;

  return (
    <div className="category-select-banner">
      <TshirtIcon aria-hidden className="category-select-icon" />
      <div className="category-select-labels">
        <span className="category-select-title">{main}</span>
        <span className="category-select-subtitle">{sub}</span>
      </div>
    </div>
  );
}
