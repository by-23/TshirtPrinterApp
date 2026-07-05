import { useTranslation } from "react-i18next";
import { TouchButton } from "@tshirt/ui-kit";
import { useEditorStore } from "./store.js";
import { estimatePriceTenge } from "./pricingStub.js";
import { blockBorderStyle } from "./borderStyle.js";

export interface PriceAndPrintProps {
  onPrint: () => void;
}

/**
 * Price block + "Печать" button + footer note, matching the right panel of
 * `docs/ui-mockups/editor.png`. The amount is a Stage-2 placeholder
 * (see `pricingStub.ts`) until `shared-pricing` lands in Stage 4.
 */
export function PriceAndPrint({ onPrint }: PriceAndPrintProps) {
  const { t } = useTranslation();
  const garmentType = useEditorStore((state) => state.garmentType);
  const size = useEditorStore((state) => state.size);
  const price = estimatePriceTenge(garmentType, size);

  return (
    <div className="flex flex-col" style={{ gap: "var(--editor-price-section-gap)" }}>
      <div style={blockBorderStyle("price-block")}>
        <h3
          className="font-semibold uppercase tracking-wide text-ink-200"
          style={{ fontSize: "var(--editor-price-label-size)" }}
        >
          {t("editor.price.label")}
        </h3>
        <p
          className="font-extrabold"
          style={{ fontSize: "var(--editor-price-amount-size)", color: "var(--editor-price-color)" }}
        >
          {price.toLocaleString("ru-RU")} ₸
        </p>
        <p className="text-ink-200" style={{ fontSize: "var(--editor-price-leadtime-size)" }}>
          {t("editor.price.leadTime", { time: t("editor.price.leadTimeValue") })}
        </p>
      </div>

      <TouchButton
        onClick={onPrint}
        className="flex w-full items-center justify-center font-bold uppercase tracking-wide text-white shadow-neon-pink transition-transform hover:scale-[1.02]"
        style={{
          height: "var(--editor-print-btn-height)",
          borderRadius: "var(--editor-print-btn-radius)",
          backgroundColor: "var(--editor-print-btn-bg)",
          fontSize: "var(--editor-print-btn-font-size)",
        }}
      >
        🖶 {t("common.print")}
      </TouchButton>

      <p
        className="text-ink-200"
        style={{ fontSize: "var(--editor-ordernote-text-size)", ...blockBorderStyle("ordernote-block") }}
      >
        🔒 {t("editor.orderSavedNote")}
      </p>
    </div>
  );
}
