import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { OrderStatus } from "@tshirt/shared-types";
import { fetchOrder, subscribeOrderEvents } from "../../../lib/pointServer.js";
import { useCheckoutStore } from "../../../lib/checkoutStore.js";
import { LanguageSwitcherSlot } from "../../../components/KioskShell.js";
import { ArrowLeft } from "../../../components/icons.js";
import { blockBorderStyle, dividerStyle } from "./borderStyle.js";
import { CheckoutPreview } from "./CheckoutPreview.js";
import { OrderSummary } from "./OrderSummary.js";
import { PaymentQrCard } from "./PaymentQrCard.js";
import { PaymentCashCard } from "./PaymentCashCard.js";
import { PaymentSteps } from "./PaymentSteps.js";
import { CheckoutFooter } from "./CheckoutFooter.js";
import { AcceptedNotice } from "./AcceptedNotice.js";
import { CancelledNotice } from "./CancelledNotice.js";

const POLL_INTERVAL_MS = 3000;

/**
 * `/kiosk/checkout` — "Оформление заказа" screen, strictly matching
 * `docs/ui-mockups/checkout.png`. Reads the order created by `Editor.tsx`'s
 * "Печать" button from `checkoutStore`; if that's empty (e.g. a page
 * refresh), there's nothing to check out, so bounce back to the editor.
 */
export function Checkout() {
  const { t } = useTranslation();
  const garment = useCheckoutStore((state) => state.garment);
  const order = useCheckoutStore((state) => state.order);
  const priceBreakdown = useCheckoutStore((state) => state.priceBreakdown);
  const [status, setStatus] = useState<OrderStatus | null>(order?.status ?? null);
  const pollingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!order || status !== "new") return;

    pollingRef.current = window.setInterval(() => {
      fetchOrder(order.id)
        .then((fresh) => setStatus(fresh.status))
        .catch(() => {
          // point-server unreachable — keep waiting, fail-open (Stage 7 covers reconnect/retry).
        });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current !== null) window.clearInterval(pollingRef.current);
    };
  }, [order, status]);

  // Instant status updates from the operator (Stage 5) — the poll above stays
  // as a fail-open fallback in case the socket connection drops.
  useEffect(() => {
    if (!order) return;
    return subscribeOrderEvents((event) => {
      if (event.type === "updated" && event.order.id === order.id) {
        setStatus(event.order.status);
      }
    });
  }, [order]);

  if (!garment || !order) {
    return <Navigate to="/kiosk/editor" replace />;
  }

  return (
    <div
      className="checkout-theme-root flex h-full w-full flex-col overflow-y-auto px-4 py-8 text-white"
      style={{ backgroundColor: "var(--checkout-page-bg)", gap: "var(--checkout-page-section-gap)" }}
    >
      <header className="relative flex items-center justify-between gap-4">
        <Link
          to="/kiosk/editor"
          aria-label={t("checkout.backTitle")}
          className="flex flex-shrink-0 items-center gap-2 px-3 text-white transition-colors hover:brightness-125"
          style={{
            width: "var(--checkout-back-btn-width)",
            height: "var(--checkout-back-btn-height)",
            borderRadius: "var(--checkout-back-btn-radius)",
            backgroundColor: "var(--checkout-back-btn-bg)",
            borderStyle: "solid",
            borderWidth: "var(--checkout-back-btn-border-width)",
            borderColor:
              "color-mix(in srgb, var(--checkout-back-btn-border-color) calc(var(--checkout-back-btn-border-opacity) * 100%), transparent)",
          }}
        >
          <ArrowLeft aria-hidden className="h-5 w-5 flex-shrink-0" strokeWidth={2.6} />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold uppercase tracking-wide">{t("checkout.backTitle")}</span>
            <span className="text-xs font-medium text-ink-300">{t("checkout.backSubtitle")}</span>
          </span>
        </Link>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <h1
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "var(--checkout-header-title-size)", color: "var(--checkout-header-title-color)" }}
          >
            {t("checkout.title")}
          </h1>
          <p
            className="font-semibold uppercase tracking-wide"
            style={{ fontSize: "var(--checkout-header-subtitle-size)", color: "var(--checkout-header-subtitle-color)" }}
          >
            {t("checkout.subtitle")}
          </p>
        </div>
        <LanguageSwitcherSlot />
      </header>

      <div aria-hidden style={dividerStyle("header")} />

      <div className="flex flex-col lg:flex-row lg:items-stretch" style={{ gap: "var(--checkout-main-columns-gap)" }}>
        <div className="flex flex-shrink-0 justify-center lg:w-[var(--checkout-preview-column-width)]">
          <CheckoutPreview garment={garment} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <OrderSummary garment={garment} priceBreakdown={priceBreakdown} />
        </div>
      </div>

      <section className="flex flex-col" style={{ gap: "var(--checkout-payment-section-gap)" }}>
        <h2
          className="text-center font-bold uppercase tracking-wide text-white"
          style={{ fontSize: "var(--checkout-payment-title-size)" }}
        >
          {t("checkout.payment.title")}
        </h2>

        <div className="flex flex-col items-stretch lg:flex-row" style={{ gap: "var(--checkout-payment-cards-gap)" }}>
          <PaymentQrCard orderId={order.id} />
          <div className="flex flex-shrink-0 items-center justify-center lg:flex-col" style={{ gap: "var(--checkout-payment-or-gap)" }}>
            <div aria-hidden className="lg:hidden" style={dividerStyle("payment-or")} />
            <span
              className="font-bold uppercase tracking-wide text-ink-300"
              style={{ fontSize: "var(--checkout-payment-or-font-size)" }}
            >
              {t("checkout.payment.or")}
            </span>
            <div aria-hidden className="hidden lg:block" style={dividerStyle("payment-or", "vertical")} />
          </div>
          <PaymentCashCard orderId={order.id} />
        </div>
      </section>

      <PaymentSteps />

      <p style={{ ...blockBorderStyle("info-bar"), fontSize: "var(--checkout-info-bar-font-size)" }} className="text-center text-ink-200">
        ⓘ {t("checkout.infoBar")}
      </p>

      <CheckoutFooter />

      {status === "cancelled" ? <CancelledNotice /> : status && status !== "new" && <AcceptedNotice />}
    </div>
  );
}
