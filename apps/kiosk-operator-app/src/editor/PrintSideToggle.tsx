import { useTranslation } from "react-i18next";
import { garmentSideSchema } from "@tshirt/shared-types";
import { PillButton } from "@tshirt/ui-kit";
import { RAIL_ICON_CLASS, TshirtIcon } from "../components/icons.js";
import { useEditorStore } from "./store.js";

/**
 * Print side (front/back) switch shown below the editor header, matching
 * the reference mockup exactly — no garment-type (t-shirt/hoodie) switch
 * on this screen.
 */
export function PrintSideToggle() {
  const { t } = useTranslation();
  const side = useEditorStore((state) => state.side);
  const setSide = useEditorStore((state) => state.setSide);

  return (
    <div className="flex items-center justify-center" style={{ gap: "var(--editor-toggle-gap)" }}>
      <span
        className="font-semibold uppercase tracking-wide text-ink-200"
        style={{ fontSize: "var(--editor-toggle-label-size)" }}
      >
        {t("editor.printSide")}
      </span>
      <div className="flex" style={{ gap: "var(--editor-toggle-gap)" }}>
        {garmentSideSchema.options.map((sideOption) => {
          const active = side === sideOption;
          return (
            <PillButton
              key={sideOption}
              active={active}
              onClick={() => setSide(sideOption)}
              icon={<TshirtIcon className={RAIL_ICON_CLASS} />}
              className="px-6"
              style={{
                height: "var(--editor-toggle-btn-height)",
                borderRadius: "var(--editor-toggle-pill-radius)",
                fontSize: "var(--editor-toggle-font-size)",
                backgroundColor: active ? "var(--editor-toggle-active-bg)" : "var(--editor-toggle-idle-bg)",
              }}
            >
              {t(`editor.sides.${sideOption}`)}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}
