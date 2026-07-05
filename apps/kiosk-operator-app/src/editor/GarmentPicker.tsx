import { useTranslation } from "react-i18next";
import { GARMENT_COLORS, GARMENT_SIZES, GARMENT_FABRICS } from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { useEditorStore } from "./store.js";

/**
 * Right-panel garment options (color / size / material) for the editor,
 * matching `docs/ui-mockups/editor.png`. Garment type + print side live in
 * `GarmentTypeToggle` under the header instead.
 */
export function GarmentPicker() {
  const { t } = useTranslation();
  const color = useEditorStore((state) => state.color);
  const size = useEditorStore((state) => state.size);
  const fabricName = useEditorStore((state) => state.fabricName);
  const setColor = useEditorStore((state) => state.setColor);
  const setSize = useEditorStore((state) => state.setSize);
  const setFabricName = useEditorStore((state) => state.setFabricName);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.color")}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {GARMENT_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setColor(option.hex)}
              aria-pressed={color === option.hex}
              aria-label={t(`editor.colors.${option.id}`)}
              title={t(`editor.colors.${option.id}`)}
              className={`h-9 w-full rounded-lg border-2 transition-transform ${
                color === option.hex ? "scale-105 border-neon-pink shadow-neon-pink" : "border-ink-600"
              }`}
              style={{ backgroundColor: option.hex }}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.size")}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {GARMENT_SIZES.map((sizeOption) => (
            <PillButton
              key={sizeOption}
              active={size === sizeOption}
              onClick={() => setSize(sizeOption)}
              className="w-full px-0 py-2"
            >
              {sizeOption}
            </PillButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.fabric")}
        </h3>
        <div className="flex flex-wrap gap-2">
          {GARMENT_FABRICS.map((fabricOption) => (
            <PillButton
              key={fabricOption}
              active={fabricName === fabricOption}
              onClick={() => setFabricName(fabricOption)}
            >
              {t(`editor.fabrics.${fabricOption}`)}
            </PillButton>
          ))}
        </div>
      </section>
    </div>
  );
}
