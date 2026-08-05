import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { POINT_SERVER_URL } from "../../../lib/pointServer.js";
import { blockBorderStyle, cardGradientStyle, contentBoxStyle } from "./borderStyle.js";
import { checkoutThemeSection } from "./themeSections.js";

const TIMER_SECONDS = 15 * 60;

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface PaymentQrCardProps {
  orderId: string;
}

/**
 * "ОПЛАТА ПО QR" card on `checkout.png` — no real bank integration (payment
 * in-app isn't implemented per `docs/PLAN.md` "Допущения"), so the QR just
 * encodes a placeholder pay link and the countdown is a purely visual clock.
 */
export function PaymentQrCard({ orderId }: PaymentQrCardProps) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-1 flex-col items-center"
      {...checkoutThemeSection("qrCard")}
      style={{
        ...cardGradientStyle("qr-card"),
        gap: "var(--checkout-qr-card-gap)",
        ...blockBorderStyle("qr-card"),
      }}
    >
      <h4
        className="font-bold uppercase tracking-wide text-white"
        style={{ fontSize: "var(--checkout-qr-title-size)" }}
      >
        {t("checkout.payment.qr.title")}
      </h4>
      <p
        className="text-center text-ink-200"
        style={{ fontSize: "var(--checkout-qr-subtitle-size)", width: "var(--checkout-qr-subtitle-width)" }}
      >
        {t("checkout.payment.qr.subtitle")}
      </p>

      <div
        className="flex items-center justify-center bg-white"
        style={{
          width: "var(--checkout-qr-code-size)",
          height: "var(--checkout-qr-code-size)",
          borderRadius: "var(--checkout-qr-code-radius)",
          padding: "var(--checkout-qr-code-padding)",
        }}
      >
        <QRCodeSVG value={`${POINT_SERVER_URL}/pay/${orderId}`} className="h-full w-full" />
      </div>

      <div className="flex flex-col items-center" style={contentBoxStyle("qr-timer-box")}>
        <span
          className="text-center font-semibold uppercase tracking-wide"
          style={{ fontSize: "var(--checkout-qr-timer-label-size)", color: "var(--checkout-qr-timer-label-color)" }}
        >
          {t("checkout.payment.qr.timerLabel")}
        </span>
        <span
          className="font-extrabold tabular-nums leading-none"
          style={{ fontSize: "var(--checkout-qr-timer-value-size)", color: "var(--checkout-qr-timer-value-color)" }}
        >
          {formatCountdown(secondsLeft)}
        </span>
      </div>

      <p
        className="text-center text-ink-300"
        style={{ fontSize: "var(--checkout-qr-note-size)", width: "var(--checkout-qr-note-width)" }}
      >
        {t("checkout.payment.qr.note")}
      </p>
    </div>
  );
}
