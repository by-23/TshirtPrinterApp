import { useTranslation } from "react-i18next";
import {
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentTypeSchema,
  garmentSideSchema,
  type GarmentType,
} from "@tshirt/shared-types";
import { TouchButton } from "@tshirt/ui-kit";
import { useEditorStore } from "./store.js";

const GARMENT_TYPE_ICONS: Record<GarmentType, string> = {
  tshirt: "👕",
  hoodie: "🧥",
};

export function GarmentPicker() {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const side = useEditorStore((state) => state.side);
  const color = useEditorStore((state) => state.color);
  const size = useEditorStore((state) => state.size);
  const fabricName = useEditorStore((state) => state.fabricName);
  const setGarmentType = useEditorStore((state) => state.setGarmentType);
  const setSide = useEditorStore((state) => state.setSide);
  const setColor = useEditorStore((state) => state.setColor);
  const setSize = useEditorStore((state) => state.setSize);
  const setFabricName = useEditorStore((state) => state.setFabricName);

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-gray-50 p-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.garmentType")}</h3>
        <div className="flex gap-2">
          {garmentTypeSchema.options.map((type) => (
            <TouchButton
              key={type}
              onClick={() => setGarmentType(type)}
              aria-pressed={garmentType === type}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                garmentType === type ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg">{GARMENT_TYPE_ICONS[type]}</span>
              {t(`editor.garmentTypes.${type}`)}
            </TouchButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.side")}</h3>
        <div className="flex gap-2">
          {garmentSideSchema.options.map((sideOption) => (
            <TouchButton
              key={sideOption}
              onClick={() => setSide(sideOption)}
              aria-pressed={side === sideOption}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                side === sideOption ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t(`editor.sides.${sideOption}`)}
            </TouchButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.color")}</h3>
        <div className="flex gap-2">
          {GARMENT_COLORS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setColor(option.hex)}
              aria-pressed={color === option.hex}
              aria-label={t(`editor.colors.${option.id}`)}
              title={t(`editor.colors.${option.id}`)}
              className={`h-9 w-9 rounded-full border-2 transition-transform ${
                color === option.hex ? "scale-110 border-black" : "border-gray-200"
              }`}
              style={{ backgroundColor: option.hex }}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.size")}</h3>
        <div className="flex flex-wrap gap-2">
          {GARMENT_SIZES.map((sizeOption) => (
            <TouchButton
              key={sizeOption}
              onClick={() => setSize(sizeOption)}
              aria-pressed={size === sizeOption}
              className={`h-10 w-12 rounded-lg text-sm font-semibold transition-colors ${
                size === sizeOption ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              {sizeOption}
            </TouchButton>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-500">{t("editor.fabric")}</h3>
        <div className="flex flex-wrap gap-2">
          {GARMENT_FABRICS.map((fabricOption) => (
            <TouchButton
              key={fabricOption}
              onClick={() => setFabricName(fabricOption)}
              aria-pressed={fabricName === fabricOption}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                fabricName === fabricOption ? "bg-black text-white" : "bg-white text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t(`editor.fabrics.${fabricOption}`)}
            </TouchButton>
          ))}
        </div>
      </section>
    </div>
  );
}
