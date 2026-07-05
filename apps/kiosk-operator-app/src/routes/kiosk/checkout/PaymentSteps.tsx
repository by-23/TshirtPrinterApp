import { useTranslation } from "react-i18next";
import {
  checkoutStepImageKey,
  useKioskImage,
  type CheckoutQrStepId,
} from "../../../lib/kioskImages.js";
import { blockBorderStyle } from "./borderStyle.js";

const STEP_KEYS = ["openApp", "scanQr", "confirmPayment", "orderToPrint"] as const satisfies readonly CheckoutQrStepId[];

function PaymentStepItem({ stepKey }: { stepKey: CheckoutQrStepId }) {
  const { t } = useTranslation();
  const imageUrl = useKioskImage(checkoutStepImageKey(stepKey));

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
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="text-white/30" aria-hidden>
            —
          </span>
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
