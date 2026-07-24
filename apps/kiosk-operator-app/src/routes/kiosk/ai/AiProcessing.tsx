import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiProvider } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { stylizeAiPhoto } from "../../../lib/pointServer.js";
import { removeImageBackground } from "../../../lib/backgroundRemoval.js";
import { AiStepIndicator } from "./AiStepIndicator.js";
import { SpinnerIcon } from "../../../components/icons.js";

function localizeStylizeError(message: string, provider: AiProvider, t: (key: string) => string): string {
  const lower = message.toLowerCase();
  if (lower.includes("chatgpt") || provider === "chatgpt") {
    return t("ai.processing.errorChatgpt");
  }
  if (lower.includes("gemini") || provider === "gemini") {
    return t("ai.processing.errorGemini");
  }
  if (lower.includes("unavailable") || lower.includes("503")) {
    return t("ai.processing.errorUnavailable");
  }
  return t("ai.processing.error");
}

/**
 * "Обработка" screen — runs stylization (+ optional BG removal).
 * Sized for the 1080×1920 kiosk like the other AI steps (not tiny Tailwind defaults).
 */
export function AiProcessing() {
  const { t } = useTranslation();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
  const aiProvider = useAiFlowStore((state) => state.aiProvider);
  const removeBackground = useAiFlowStore((state) => state.removeBackground);
  const processingStage = useAiFlowStore((state) => state.processingStage);
  const error = useAiFlowStore((state) => state.error);
  const setStep = useAiFlowStore((state) => state.setStep);
  const setStylizedImage = useAiFlowStore((state) => state.setStylizedImage);
  const setFinalImage = useAiFlowStore((state) => state.setFinalImage);
  const setProcessingStage = useAiFlowStore((state) => state.setProcessingStage);
  const setError = useAiFlowStore((state) => state.setError);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sourcePhoto || !selectedStyleKey) {
      setStep("style");
      return;
    }

    let cancelled = false;
    setError(null);
    setProcessingStage("stylizing");

    void (async () => {
      const { imageBase64: stylized } = await stylizeAiPhoto(sourcePhoto, selectedStyleKey, aiProvider);
      if (cancelled) return;
      setStylizedImage(stylized);
      if (removeBackground) {
        setProcessingStage("removingBackground");
        const finalImage = await removeImageBackground(stylized);
        if (cancelled) return;
        setFinalImage(finalImage);
      } else {
        setFinalImage(stylized);
      }
      setStep("result");
    })().catch((err: unknown) => {
      if (cancelled) return;
      const raw = err instanceof Error ? err.message : "";
      setError(localizeStylizeError(raw, aiProvider, t));
    });

    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only when the user presses "Повторить" (`attempt`), not on every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="ai-processing-screen">
      <AiStepIndicator current="processing" />

      {error ? (
        <div className="ai-processing-body">
          <p className="ai-processing-error">{error}</p>
          <div className="ai-processing-actions">
            <button type="button" onClick={() => setStep("style")} className="ai-style-back-btn">
              {t("ai.processing.backToStyles")}
            </button>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="ai-style-stylize-btn">
              {t("ai.processing.retry")}
            </button>
          </div>
        </div>
      ) : (
        <div className="ai-processing-body">
          <SpinnerIcon aria-hidden className="ai-processing-spinner animate-spin" />
          <p className="ai-processing-title">
            {processingStage === "removingBackground"
              ? t("ai.processing.removingBackground")
              : t("ai.processing.stylizing")}
          </p>
          <p className="ai-processing-hint">{t("ai.processing.hint")}</p>
        </div>
      )}
    </div>
  );
}
