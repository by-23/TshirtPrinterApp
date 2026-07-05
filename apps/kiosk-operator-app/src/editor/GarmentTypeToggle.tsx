import { useTranslation } from "react-i18next";
import { garmentTypeSchema, garmentSideSchema, type GarmentType } from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { useEditorStore } from "./store.js";

const GARMENT_TYPE_ICONS: Record<GarmentType, string> = {
  tshirt: "👕",
  hoodie: "🧥",
};

/**
 * Garment type (t-shirt/hoodie) + print side (front/back) switches shown
 * below the editor header, matching the pill row in `docs/ui-mockups/editor.png`.
 * The mockup only shows the side switch explicitly; the garment-type toggle
 * (required by Stage 2 scope) is added as a compact companion pill so it
 * doesn't disrupt the mockup's layout balance.
 */
export function GarmentTypeToggle() {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const side = useEditorStore((state) => state.side);
  const setGarmentType = useEditorStore((state) => state.setGarmentType);
  const setSide = useEditorStore((state) => state.setSide);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {garmentTypeSchema.options.map((type) => (
          <PillButton
            key={type}
            active={garmentType === type}
            onClick={() => setGarmentType(type)}
            icon={<span aria-hidden>{GARMENT_TYPE_ICONS[type]}</span>}
            className="px-3 py-1 text-xs"
          >
            {t(`editor.garmentTypes.${type}`)}
          </PillButton>
        ))}
      </div>

      <span className="text-xs font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.printSide")}
      </span>
      <div className="flex gap-2">
        {garmentSideSchema.options.map((sideOption) => (
          <PillButton
            key={sideOption}
            active={side === sideOption}
            onClick={() => setSide(sideOption)}
            icon={<span aria-hidden>{GARMENT_TYPE_ICONS[garmentType]}</span>}
          >
            {t(`editor.sides.${sideOption}`)}
          </PillButton>
        ))}
      </div>
    </div>
  );
}
