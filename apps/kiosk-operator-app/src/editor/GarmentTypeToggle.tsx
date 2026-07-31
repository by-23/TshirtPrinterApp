import { useTranslation } from "react-i18next";
import { garmentTypeSchema, isGarmentTypeEnabled, type GarmentType } from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { RAIL_ICON_CLASS, TshirtIcon } from "../components/icons.js";
import { useEditorStore } from "./store.js";
import { useGarmentAvailabilityStore } from "../lib/garmentAvailabilityStore.js";

/**
 * Garment type switch (футболка / свитшот / кепка / шоппер) shown above
 * `PrintSideToggle`. The design on the canvas is kept when switching —
 * only the mockup, print area, and (for cap/shopper) size/fabric/side
 * constraints change.
 */
export function GarmentTypeToggle() {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const setGarmentType = useEditorStore((state) => state.setGarmentType);
  const availability = useGarmentAvailabilityStore((state) => state.availability);

  function handleSelect(nextType: GarmentType) {
    if (nextType === garmentType) return;
    if (!isGarmentTypeEnabled(availability, nextType)) return;
    setGarmentType(nextType);
  }

  return (
    <div className="flex items-center justify-center" style={{ gap: "var(--editor-toggle-gap)" }}>
      <span
        className="font-semibold uppercase tracking-wide text-ink-200"
        style={{ fontSize: "var(--editor-toggle-label-size)" }}
      >
        {t("editor.garmentType")}
      </span>
      <div className="flex flex-wrap justify-center" style={{ gap: "var(--editor-toggle-gap)" }}>
        {garmentTypeSchema.options.map((typeOption) => {
          const active = garmentType === typeOption;
          const catalogEnabled = isGarmentTypeEnabled(availability, typeOption);
          return (
            <PillButton
              key={typeOption}
              active={active}
              disabled={!catalogEnabled}
              onClick={() => handleSelect(typeOption)}
              icon={<TshirtIcon className={RAIL_ICON_CLASS} />}
              className="px-6"
              style={{
                height: "var(--editor-toggle-btn-height)",
                borderRadius: "var(--editor-toggle-pill-radius)",
                fontSize: "var(--editor-toggle-font-size)",
                backgroundColor: active ? "var(--editor-toggle-active-bg)" : "var(--editor-toggle-idle-bg)",
              }}
            >
              {t(`editor.garmentTypes.${typeOption}`)}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
