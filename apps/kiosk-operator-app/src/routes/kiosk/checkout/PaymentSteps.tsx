import type { ComponentType, SyntheticEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CircleCheck,
  Printer,
  QrCode,
  Smartphone,
  type IconProps,
} from "../../../components/icons.js";
import {
  checkoutStepImageKey,
  useKioskImage,
  type CheckoutQrStepId,
} from "../../../lib/kioskImages.js";
import { blockBorderStyle } from "./borderStyle.js";

const STEP_KEYS = ["openApp", "scanQr", "confirmPayment", "orderToPrint"] as const satisfies readonly CheckoutQrStepId[];

/** Emergency fallback only — primary art is the bundled PNGs from the design pack. */
const STEP_FALLBACK_ICONS: Record<CheckoutQrStepId, ComponentType<IconProps>> = {
  openApp: Smartphone,
  scanQr: QrCode,
  confirmPayment: CircleCheck,
  orderToPrint: Printer,
};

function PaymentStepItem({ stepKey }: { stepKey: CheckoutQrStepId }) {
  const { t } = useTranslation();
  const imageUrl = useKioskImage(checkoutStepImageKey(stepKey));
  const [imageFailed, setImageFailed] = useState(false);
  const FallbackIcon = STEP_FALLBACK_ICONS[stepKey];

  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ width: "var(--checkout-steps-item-width)", gap: "var(--checkout-steps-item-gap)" }}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: "var(--checkout-steps-badge-size)",
          height: "var(--checkout-steps-badge-size)",
          borderRadius: "var(--checkout-steps-badge-radius)",
          color: "#ffffff",
        }}
      >
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-contain"
            onError={(_event: SyntheticEvent<HTMLImageElement>) => setImageFailed(true)}
          />
        ) : (
          <FallbackIcon
            aria-hidden
            strokeWidth={1.8}
            style={{
              width: "calc(var(--checkout-steps-badge-size) * 0.72)",
              height: "calc(var(--checkout-steps-badge-size) * 0.72)",
            }}
          />
        )}
      </div>
      <span className="text-ink-200" style={{ fontSize: "var(--checkout-steps-text-size)" }}>
        {t(`checkout.steps.items.${stepKey}`)}
      </span>
    </div>
  );
}

/** "КАК ОПЛАТИТЬ ПО QR" 4-step strip on `checkout.png` — purely informational. */
export function PaymentSteps() {
  const { t } = useTranslation();

  return (
    <section style={blockBorderStyle("steps-block")}>
      <h3
        className="text-center font-bold uppercase tracking-wide text-white"
        style={{ fontSize: "var(--checkout-steps-title-size)" }}
      >
        {t("checkout.steps.title")}
      </h3>
      <div
        className="flex flex-wrap justify-center"
        style={{ gap: "var(--checkout-steps-gap)", marginTop: "var(--checkout-steps-title-gap)" }}
      >
        {STEP_KEYS.map((key) => (
          <PaymentStepItem key={key} stepKey={key} />
        ))}
      </div>
    </section>
  );
}
