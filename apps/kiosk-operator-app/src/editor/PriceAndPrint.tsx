import { useTranslation } from "react-i18next";
import { TouchButton } from "@tshirt/ui-kit";
import { useEditorStore } from "./store.js";
import { estimatePriceTenge } from "./pricingStub.js";

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
    <div className="flex flex-col gap-3 border-t border-ink-700 pt-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-200">
          {t("editor.price.label")}
        </h3>
        <p className="text-2xl font-extrabold text-white">
          {price.toLocaleString("ru-RU")} ₸
        </p>
        <p className="text-xs text-ink-200">
          {t("editor.price.leadTime", { time: t("editor.price.leadTimeValue") })}
        </p>
      </div>

      <TouchButton
        onClick={onPrint}
        className="rounded-full bg-neon-pink py-4 text-lg font-bold uppercase tracking-wide text-white shadow-neon-pink transition-transform hover:scale-[1.02]"
      >
        🖶 {t("common.print")}
      </TouchButton>

      <p className="text-center text-[11px] text-ink-200">🔒 {t("editor.orderSavedNote")}</p>
    </div>
  );
}
