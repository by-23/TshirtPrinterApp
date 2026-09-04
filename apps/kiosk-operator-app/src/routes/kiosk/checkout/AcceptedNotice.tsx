import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "../../../components/icons.js";
import { resetEditorSession } from "../../../editor/history.js";
import { useCheckoutStore } from "../../../lib/checkoutStore.js";
import { checkoutThemeSection } from "./themeSections.js";

/** How long "Заказ принят, ждите 5 мин" stays on screen before returning to the kiosk home — see `docs/PLAN.md` Этап 4 ("автоскрытие 15–20 сек"). */
const AUTO_HIDE_MS = 18000;

/**
 * Shown once the operator flips the order's status away from `new` (polled
 * in `Checkout.tsx`). Stage 5 supplies the actual "Принять заказ" button;
 * this component just reacts to whatever status change eventually happens.
 */
export function AcceptedNotice() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const goHome = () => {
    resetEditorSession();
    useCheckoutStore.getState().reset();
    navigate("/kiosk", { replace: true });
  };

  useEffect(() => {
    const timeout = window.setTimeout(goHome, AUTO_HIDE_MS);
    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-black/70 backdrop-blur-sm"
      role="button"
      tabIndex={0}
      onClick={goHome}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goHome();
      }}
    >
      <div
        className="flex flex-col items-center text-center"
        {...checkoutThemeSection("accepted")}
        style={{
          gap: "var(--checkout-accepted-gap)",
          padding: "var(--checkout-accepted-padding)",
          borderRadius: "var(--checkout-accepted-radius)",
          backgroundColor: "var(--checkout-accepted-bg)",
        }}
      >
        <CircleCheck style={{ width: "var(--checkout-accepted-icon-size)", height: "var(--checkout-accepted-icon-size)", color: "var(--checkout-accepted-icon-color)" }} />
        <h2
          className="font-extrabold uppercase tracking-wide text-white"
          style={{ fontSize: "var(--checkout-accepted-title-size)" }}
        >
          {t("checkout.accepted.title")}
        </h2>
        <p className="text-ink-200" style={{ fontSize: "var(--checkout-accepted-subtitle-size)" }}>
          {t("checkout.accepted.subtitle", { time: t("editor.price.leadTimeValue") })}
        </p>
      </div>
    </div>
  );
}
