import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAiFlowStore, type AiFlowStep } from "../../../lib/aiFlowStore.js";
import { warmBackgroundRemoval } from "../../../lib/backgroundRemoval.js";
import { LanguageSwitcherSlot } from "../../../components/KioskShell.js";
import { ArrowLeft } from "../../../components/icons.js";
import { AiSourceSelect } from "./AiSourceSelect.js";
import { AiCameraCapture } from "./AiCameraCapture.js";
import { AiQrUpload } from "./AiQrUpload.js";
import { AiStyleSelect } from "./AiStyleSelect.js";
import { AiProcessing } from "./AiProcessing.js";
import { AiResult } from "./AiResult.js";

/** Where the top-left "Назад" button lands from each step — linear, not a full history stack (kept simple per docs/PLAN.md Этап 9). */
const PREVIOUS_STEP: Partial<Record<AiFlowStep, AiFlowStep>> = {
  camera: "source",
  qr: "source",
  style: "source",
  processing: "style",
  result: "style",
};

/**
 * `/kiosk/ai` — "ИИ-стиль" wizard container (Этап 9). Renders the current
 * step from `aiFlowStore` and owns the shared top bar (back button +
 * language switcher slot, same layout as `Editor.tsx`/`Checkout.tsx`).
 */
export function AiFlow() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const step = useAiFlowStore((state) => state.step);
  const setStep = useAiFlowStore((state) => state.setStep);
  const restartStyleSelection = useAiFlowStore((state) => state.restartStyleSelection);
  const reset = useAiFlowStore((state) => state.reset);
  const isSourceStep = step === "source";

  useEffect(() => {
    warmBackgroundRemoval();
  }, []);

  function handleBack() {
    if (step === "source") {
      reset();
      navigate("/kiosk");
      return;
    }
    const previous = PREVIOUS_STEP[step] ?? "source";
    if (previous === "style") {
      restartStyleSelection();
    } else {
      setStep(previous);
    }
  }

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden text-white ${isSourceStep ? "ai-theme-root" : ""}`}
      style={{ backgroundColor: isSourceStep ? "var(--ai-page-bg)" : "#000000" }}
    >
      <header className={isSourceStep ? "ai-flow-header" : "relative flex flex-shrink-0 items-center justify-between px-5 py-4"}>
        <button
          type="button"
          onClick={handleBack}
          aria-label={t("common.back")}
          className={isSourceStep ? "ai-flow-back-btn" : "ai-flow-back-btn flex items-center gap-2 px-3 py-2 text-white transition-colors hover:brightness-125"}
          style={
            isSourceStep
              ? undefined
              : {
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                  background: "transparent",
                  borderRadius: "14px",
                }
          }
        >
          <ArrowLeft
            aria-hidden
            className={isSourceStep ? "ai-flow-back-btn-icon" : "h-5 w-5 flex-shrink-0"}
            strokeWidth={2.6}
          />
          <span className="flex flex-col text-left leading-tight">
            <span className={isSourceStep ? "ai-flow-back-btn-title" : "text-sm font-bold uppercase tracking-wide"}>
              {t("common.back")}
            </span>
            <span className={isSourceStep ? "ai-flow-back-btn-subtitle" : "text-xs font-medium text-ink-300"}>
              {t("ai.backHome")}
            </span>
          </span>
        </button>
        <LanguageSwitcherSlot />
      </header>

      <div className="min-h-0 flex-1">
        {step === "source" && <AiSourceSelect />}
        {step === "camera" && <AiCameraCapture />}
        {step === "qr" && <AiQrUpload />}
        {step === "style" && <AiStyleSelect />}
        {step === "processing" && <AiProcessing />}
        {step === "result" && <AiResult />}
      </div>
    </div>
  );
}
