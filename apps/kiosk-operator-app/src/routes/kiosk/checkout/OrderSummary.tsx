import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { GARMENT_COLORS } from "@tshirt/shared-types";
import type { PriceBreakdownKey, PriceBreakdownLine } from "@tshirt/shared-pricing";
import { Clock, type IconProps, Palette, Ruler, Tag, TshirtIcon } from "../../../components/icons.js";
import type { CheckoutGarment } from "../../../lib/checkoutStore.js";
import { blockBorderStyle, dividerStyle } from "./borderStyle.js";

export interface OrderSummaryProps {
  garment: CheckoutGarment;
  priceBreakdown: PriceBreakdownLine[];
}

const ROW_ORDER: PriceBreakdownKey[] = ["garment", "design", "size", "side"];

const ROW_ICONS: Record<PriceBreakdownKey, ComponentType<IconProps>> = {
  garment: Tag,
  design: Palette,
  size: Ruler,
  side: TshirtIcon,
};

/**
 * Matches `checkout.png` exactly: the base garment price is shown plain
 * (no sign), while the three surcharge rows always show a leading sign —
 * including `+0 ₸` when a size/print/side doesn't add anything.
 */
function formatAmount(key: PriceBreakdownKey, amount: number): string {
  const formatted = `${amount.toLocaleString("ru-RU")} ₸`;
  if (key === "garment") return formatted;
  return amount >= 0 ? `+${formatted}` : formatted;
}

/**
 * Right-column "ВАШ ЗАКАЗ" card on `checkout.png` — 4 line items (garment,
 * design, size, print side) from `getPriceBreakdown` plus the total and
 * lead time, styled like the editor's price block (`PriceAndPrint.tsx`).
 */
export function OrderSummary({ garment, priceBreakdown }: OrderSummaryProps) {
  const { t } = useTranslation();
  const colorId = GARMENT_COLORS.find((option) => option.hex === garment.color)?.id ?? "white";
  const total = priceBreakdown.reduce((sum, line) => sum + line.amountTenge, 0);
  const amountByKey = new Map(priceBreakdown.map((line) => [line.key, line.amountTenge]));

  const rowMeta: Record<PriceBreakdownKey, { label: string; detail: string }> = {
    garment: {
      label: t(`editor.garmentTypes.${garment.type}`),
      detail: `${t(`editor.colors.${colorId}`)}, ${t(`checkout.summary.fabric.${garment.fabricName}`)}`,
    },
    design: {
      label: t("checkout.summary.designLabel"),
      detail: t("checkout.summary.designSource"),
    },
    size: {
      label: t("editor.size"),
      detail: garment.size,
    },
    side: {
      label: t("editor.printSide"),
      detail: t(`editor.sides.${garment.side}`),
    },
  };

  return (
    <section
      className="flex h-full w-full flex-col"
      style={{ ...blockBorderStyle("summary-block"), gap: "var(--checkout-summary-section-gap)" }}
    >
      <h3
        className="shrink-0 font-bold uppercase tracking-wide"
        style={{
          fontSize: "var(--checkout-summary-title-size)",
          color: "var(--checkout-summary-title-color)",
        }}
      >
        {t("checkout.summary.title")}
      </h3>

      <div className="flex min-h-0 flex-1 flex-col" style={{ gap: "var(--checkout-summary-row-gap)" }}>
        {ROW_ORDER.map((key) => {
          const RowIcon = ROW_ICONS[key];
          return (
            <div key={key} className="flex w-full items-center justify-between gap-4">
              <div
                className="flex min-w-0 flex-1 items-center"
                style={{ gap: "var(--checkout-summary-row-icon-gap)" }}
              >
                <RowIcon
                  className="flex-shrink-0"
                  style={{
                    width: "var(--checkout-summary-row-icon-size)",
                    height: "var(--checkout-summary-row-icon-size)",
                    color: "var(--checkout-summary-row-icon-color)",
                  }}
                />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span
                    className="font-bold uppercase tracking-wide"
                    style={{
                      fontSize: "var(--checkout-summary-row-label-size)",
                      color: "var(--checkout-summary-row-label-color)",
                    }}
                  >
                    {rowMeta[key].label}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--checkout-summary-row-detail-size)",
                      color: "var(--checkout-summary-row-detail-color)",
                    }}
                  >
                    {rowMeta[key].detail}
                  </span>
                </div>
              </div>
              <span
                className="shrink-0 text-right font-semibold tabular-nums"
                style={{
                  fontSize: "var(--checkout-summary-row-amount-size)",
                  color:
                    key === "garment"
                      ? "var(--checkout-summary-row-amount-color)"
                      : "var(--checkout-summary-row-surcharge-color)",
                }}
              >
                {formatAmount(key, amountByKey.get(key) ?? 0)}
              </span>
            </div>
          );
        })}
      </div>

      <div aria-hidden className="shrink-0" style={dividerStyle("summary")} />

      <div className="flex shrink-0 items-center justify-between gap-4">
        <span
          className="font-bold uppercase tracking-wide"
          style={{
            fontSize: "var(--checkout-summary-total-label-size)",
            color: "var(--checkout-summary-total-label-color)",
          }}
        >
          {t("checkout.summary.total")}
        </span>
        <span
          className="shrink-0 text-right font-extrabold tabular-nums"
          style={{ fontSize: "var(--checkout-summary-total-amount-size)", color: "var(--checkout-summary-total-color)" }}
        >
          {total.toLocaleString("ru-RU")} ₸
        </span>
      </div>

      <p
        className="flex max-w-full shrink-0 items-center font-semibold uppercase tracking-wide"
        style={{
          width: "var(--checkout-summary-leadtime-width)",
          gap: "var(--checkout-summary-leadtime-gap)",
          color: "var(--checkout-summary-leadtime-color)",
        }}
      >
        <Clock
          className="flex-shrink-0"
          style={{
            width: "var(--checkout-summary-leadtime-icon-size)",
            height: "var(--checkout-summary-leadtime-icon-size)",
          }}
        />
        <span style={{ fontSize: "var(--checkout-summary-leadtime-size)" }}>
          {t("editor.price.leadTime", { time: t("editor.price.leadTimeValue") })}
        </span>
      </p>
    </section>
  );
}
