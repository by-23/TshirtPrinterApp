import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CircleX } from "../../../components/icons.js";
import { useEditorStore } from "../../../editor/store.js";
import { useCheckoutStore } from "../../../lib/checkoutStore.js";

/** Same dwell time as `AcceptedNotice` before returning to the kiosk home. */
const AUTO_HIDE_MS = 18000;

/** Shown when the operator cancels the order (see `docs/PLAN.md` Этап 5). */
export function CancelledNotice() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      useEditorStore.getState().reset();
      useCheckoutStore.getState().reset();
      navigate("/kiosk", { replace: true });
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="status"
    >
      <div
        className="flex flex-col items-center text-center"
        style={{
          gap: "var(--checkout-accepted-gap)",
          padding: "var(--checkout-accepted-padding)",
          borderRadius: "var(--checkout-accepted-radius)",
          backgroundColor: "var(--checkout-accepted-bg)",
        }}
      >
        <CircleX
          style={{
            width: "var(--checkout-accepted-icon-size)",
            height: "var(--checkout-accepted-icon-size)",
            color: "#ff4d4f",
          }}
        />
        <h2
          className="font-extrabold uppercase tracking-wide text-white"
          style={{ fontSize: "var(--checkout-accepted-title-size)" }}
        >
          {t("checkout.cancelled.title")}
        </h2>
        <p className="text-ink-200" style={{ fontSize: "var(--checkout-accepted-subtitle-size)" }}>
          {t("checkout.cancelled.subtitle")}
        </p>
      </div>
    </div>
  );
}
