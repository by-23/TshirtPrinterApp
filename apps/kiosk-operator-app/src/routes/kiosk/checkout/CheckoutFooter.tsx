import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { POINT_SERVER_URL } from "../../../lib/pointServer.js";
import { Gift, Headset } from "../../../components/icons.js";
import { blockBorderStyle } from "./borderStyle.js";
import { checkoutThemeSection } from "./themeSections.js";

/**
 * Bottom row on `checkout.png` — "Нужна помощь? Позвать оператора" and the
 * "Поделись результатом" promo card. Neither has a real backend yet (no
 * operator paging, no discount system), so both just surface the same kind
 * of "coming soon" placeholder the rest of the kiosk uses (see
 * `editor.printError` for the analogous pattern).
 */
export function CheckoutFooter() {
  const { t } = useTranslation();
  const [placeholderKey, setPlaceholderKey] = useState<"help" | "promo" | null>(null);

  function showPlaceholder(key: "help" | "promo") {
    setPlaceholderKey(key);
    window.setTimeout(() => setPlaceholderKey(null), 3000);
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{ gap: "var(--checkout-footer-gap)" }}>
      <button
        type="button"
        onClick={() => showPlaceholder("help")}
        className="flex flex-1 items-center justify-center text-white transition-colors hover:brightness-125"
        {...checkoutThemeSection("footerHelp")}
        style={{
          gap: "var(--checkout-footer-help-gap)",
          backgroundColor: "var(--checkout-footer-help-bg)",
          ...blockBorderStyle("footer-help"),
        }}
      >
        <Headset style={{ width: "var(--checkout-footer-help-icon-size)", height: "var(--checkout-footer-help-icon-size)" }} />
        <span className="flex flex-col text-left">
          <span className="font-bold uppercase tracking-wide" style={{ fontSize: "var(--checkout-footer-help-title-size)" }}>
            {t("checkout.footer.helpTitle")}
          </span>
          <span className="text-ink-200" style={{ fontSize: "var(--checkout-footer-help-subtitle-size)" }}>
            {t("checkout.footer.helpSubtitle")}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => showPlaceholder("promo")}
        className="flex flex-1 items-center text-left transition-colors hover:brightness-110"
        {...checkoutThemeSection("footerPromo")}
        style={{
          gap: "var(--checkout-footer-promo-gap)",
          backgroundColor: "var(--checkout-footer-promo-bg)",
          ...blockBorderStyle("footer-promo"),
        }}
      >
        <Gift className="h-[1em] w-[1em] flex-shrink-0" style={{ fontSize: "var(--checkout-footer-promo-icon-size)", color: "var(--checkout-footer-promo-icon-color)" }} />
        <span className="flex flex-col">
          <span
            className="font-bold uppercase tracking-wide text-white"
            style={{ fontSize: "var(--checkout-footer-promo-title-size)" }}
          >
            {t("checkout.footer.promoTitle")}
          </span>
          <span className="text-ink-200" style={{ fontSize: "var(--checkout-footer-promo-subtitle-size)" }}>
            {t("checkout.footer.promoSubtitle")}
          </span>
        </span>
        <span
          className="ml-auto flex-shrink-0 bg-white p-1"
          style={{ borderRadius: "var(--checkout-footer-promo-qr-radius)" }}
        >
          <QRCodeSVG value={`${POINT_SERVER_URL}/promo`} size={48} />
        </span>
      </button>

      {placeholderKey && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {t(placeholderKey === "help" ? "checkout.footer.helpPlaceholder" : "checkout.footer.promoPlaceholder")}
        </div>
      )}
    </div>
  );
}
