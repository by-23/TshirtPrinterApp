import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "../../../components/icons.js";
import defaultCashArt from "../../../assets/checkout/checkout-cash-illustration.png";
import {
  checkoutCashIllustrationKey,
  hasKioskImageOverride,
  useKioskImage,
} from "../../../lib/kioskImages.js";
import { blockBorderStyle, cardGradientStyle, contentBoxStyle } from "./borderStyle.js";

/** Offset so a fresh point-server (order #1, #2...) still shows a realistic-looking 4-digit number, like on `checkout.png` ("№ 1247"). */
const ORDER_NUMBER_OFFSET = 1000;

export interface PaymentCashCardProps {
  orderId: string;
}

/**
 * "ОПЛАТА В КАССУ" card on `checkout.png` — no cash-register integration
 * either, just the number the customer shows the cashier.
 */
export function PaymentCashCard({ orderId }: PaymentCashCardProps) {
  const { t } = useTranslation();
  const orderNumber = ORDER_NUMBER_OFFSET + Number(orderId);
  const imageKey = checkoutCashIllustrationKey();
  const storedUrl = useKioskImage(imageKey);
  const hasOverride = hasKioskImageOverride(imageKey);
  const [imageFailed, setImageFailed] = useState(false);
  // Bundled design-pack PNG always wins unless the operator uploaded a real override.
  const illustrationUrl = hasOverride ? storedUrl : defaultCashArt;
  const showImage = Boolean(illustrationUrl) && !imageFailed;

  return (
    <div
      className="flex flex-1 flex-col items-center"
      style={{
        ...cardGradientStyle("cash-card"),
        gap: "var(--checkout-cash-card-gap)",
        ...blockBorderStyle("cash-card"),
      }}
    >
      <h4
        className="font-bold uppercase tracking-wide text-white"
        style={{ fontSize: "var(--checkout-cash-title-size)" }}
      >
        {t("checkout.payment.cash.title")}
      </h4>
      <p
        className="text-center text-ink-200"
        style={{ fontSize: "var(--checkout-cash-subtitle-size)", width: "var(--checkout-cash-subtitle-width)" }}
      >
        {t("checkout.payment.cash.subtitle")}
      </p>

      <div className="flex flex-col items-center" style={contentBoxStyle("cash-number-box")}>
        <span
          className="font-extrabold tabular-nums leading-none"
          style={{ fontSize: "var(--checkout-cash-number-size)", color: "var(--checkout-cash-number-color)" }}
        >
          № {orderNumber}
        </span>
        <span
          className="text-center font-semibold uppercase tracking-wide text-ink-300"
          style={{ fontSize: "var(--checkout-cash-note-size)", width: "var(--checkout-cash-note-width)" }}
        >
          {t("checkout.payment.cash.note")}
        </span>
      </div>

      {showImage ? (
        <img
          src={illustrationUrl}
          alt=""
          className="mt-auto object-contain"
          style={{
            width: "var(--checkout-cash-image-width)",
            height: "var(--checkout-cash-image-height)",
          }}
          onError={(_event: SyntheticEvent<HTMLImageElement>) => setImageFailed(true)}
        />
      ) : (
        <Users
          className="mt-auto"
          style={{
            width: "var(--checkout-cash-icon-size)",
            height: "var(--checkout-cash-icon-size)",
            color: "var(--checkout-cash-icon-color)",
          }}
        />
      )}
    </div>
  );
}
