import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  GARMENT_COLORS,
  GARMENT_SIZES,
  GARMENT_FABRICS,
  garmentUsesSizeFabric,
  isGarmentColorEnabled,
  isGarmentFabricEnabled,
  isGarmentSizeEnabled,
  type GarmentFabric,
} from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { Diamond, RAIL_ICON_CLASS } from "../components/icons.js";
import { useEditorStore } from "./store.js";
import { blockBorderStyle, blockContentRowStyle } from "./borderStyle.js";
import { useGarmentAvailabilityStore } from "../lib/garmentAvailabilityStore.js";
import { editorThemeSection } from "./themeSections.js";

const FABRIC_ICONS: Partial<Record<GarmentFabric, ReactNode>> = {
  premium: <Diamond className={RAIL_ICON_CLASS} />,
};

/**
 * Right-panel garment options (color / size / material) for the editor,
 * matching the reference mockup. Print side lives in `PrintSideToggle`
 * under the header instead.
 */
export function GarmentPicker() {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const color = useEditorStore((state) => state.color);
  const size = useEditorStore((state) => state.size);
  const fabricName = useEditorStore((state) => state.fabricName);
  const setColor = useEditorStore((state) => state.setColor);
  const setSize = useEditorStore((state) => state.setSize);
  const setFabricName = useEditorStore((state) => state.setFabricName);
  const availability = useGarmentAvailabilityStore((state) => state.availability);
  // Cap/shopper are one-size/one-material — the pills stay visible (so the
  // panel's layout doesn't shift) but disabled + dimmed, per the editor's
  // decision to never show empty gaps for unavailable options.
  const sizeFabricEnabled = garmentUsesSizeFabric(garmentType);

  return (
    <div className="flex flex-col" style={{ gap: "var(--editor-garment-blocks-gap)" }}>
      <section style={blockBorderStyle("color-block")} {...editorThemeSection("color")}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.color")}
        </h3>
        <div className="flex flex-wrap" style={{ gap: "var(--editor-swatch-gap)", ...blockContentRowStyle("color-block") }}>
          {GARMENT_COLORS.map((option) => {
            const active = color === option.hex;
            const catalogEnabled = isGarmentColorEnabled(availability, option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={!catalogEnabled}
                onClick={() => setColor(option.hex)}
                aria-pressed={active}
                aria-label={t(`editor.colors.${option.id}`)}
                title={t(`editor.colors.${option.id}`)}
                className={`flex-shrink-0 transition-transform disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none ${
                  active && catalogEnabled ? "scale-105 shadow-neon-pink" : ""
                }`}
                style={{
                  backgroundColor: option.hex,
                  width: "var(--editor-swatch-width)",
                  height: "var(--editor-swatch-height)",
                  borderRadius: "var(--editor-swatch-radius)",
                }}
              />
            );
          })}
        </div>
      </section>

      <section style={blockBorderStyle("size-block")} {...editorThemeSection("size")}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.size")}
        </h3>
        <div className="flex flex-wrap" style={{ gap: "var(--editor-size-pill-gap)", ...blockContentRowStyle("size-block") }}>
          {GARMENT_SIZES.map((sizeOption) => {
            const active = size === sizeOption;
            const catalogEnabled = isGarmentSizeEnabled(availability, sizeOption);
            return (
              <PillButton
                key={sizeOption}
                active={active}
                disabled={!sizeFabricEnabled || !catalogEnabled}
                onClick={() => setSize(sizeOption)}
                className="flex-shrink-0 px-0"
                style={{
                  width: "var(--editor-size-pill-width)",
                  height: "var(--editor-size-pill-height)",
                  borderRadius: "var(--editor-size-pill-radius)",
                  fontSize: "var(--editor-size-pill-font-size)",
                  backgroundColor: active ? "var(--editor-size-pill-active-bg)" : "var(--editor-size-pill-idle-bg)",
                }}
              >
                {sizeOption}
              </PillButton>
            );
          })}
        </div>
      </section>

      <section style={blockBorderStyle("fabric-block")} {...editorThemeSection("fabric")}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.fabric")}
        </h3>
        <div className="flex flex-wrap" style={{ gap: "var(--editor-fabric-pill-gap)", ...blockContentRowStyle("fabric-block") }}>
          {GARMENT_FABRICS.map((fabricOption) => {
            const active = fabricName === fabricOption;
            const catalogEnabled = isGarmentFabricEnabled(availability, fabricOption);
            return (
              <PillButton
                key={fabricOption}
                active={active}
                disabled={!sizeFabricEnabled || !catalogEnabled}
                onClick={() => setFabricName(fabricOption)}
                icon={FABRIC_ICONS[fabricOption]}
                className="flex-shrink-0"
                style={{
                  width: "var(--editor-fabric-pill-width)",
                  height: "var(--editor-fabric-pill-height)",
                  borderRadius: "var(--editor-fabric-pill-radius)",
                  fontSize: "var(--editor-fabric-pill-font-size)",
                  backgroundColor: active ? "var(--editor-fabric-pill-active-bg)" : "var(--editor-fabric-pill-idle-bg)",
                }}
              >
                {t(`editor.fabrics.${fabricOption}`)}
              </PillButton>
            );
          })}
        </div>
      </section>
    </div>
  );
}
