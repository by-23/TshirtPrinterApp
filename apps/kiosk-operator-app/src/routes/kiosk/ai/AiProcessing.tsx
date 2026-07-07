import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { stylizeAiPhoto } from "../../../lib/pointServer.js";
import { removeImageBackground } from "../../../lib/backgroundRemoval.js";
import { AiStepIndicator } from "./AiStepIndicator.js";
import { SpinnerIcon } from "../../../components/icons.js";

/**
 * "Обработка" screen — not covered by the reference mockups, built in the
 * same visual language per docs/PLAN.md Этап 9. Runs the actual pipeline
 * (Pollinations stylization, then client-side background removal) on
 * mount/retry, driven by `aiFlowStore.processingStage` for the two
 * sequential status messages.
 */
export function AiProcessing() {
  const { t } = useTranslation();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
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
      const { imageBase64: stylized } = await stylizeAiPhoto(sourcePhoto, selectedStyleKey);
      if (cancelled) return;
      setStylizedImage(stylized);
      setProcessingStage("removingBackground");
      const finalImage = await removeImageBackground(stylized);
      if (cancelled) return;
      setFinalImage(finalImage);
      setStep("result");
    })().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : t("ai.processing.error"));
    });

    return () => {
      cancelled = true;
    };
    // Deliberately re-runs only when the user presses "Повторить" (`attempt`), not on every store change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-6">
      <AiStepIndicator current="processing" />

      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-ink-200">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep("style")}
              className="rounded-pill bg-ink-800 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-ink-700"
            >
              {t("ai.processing.backToStyles")}
            </button>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-pill bg-neon-pink px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-neon-pink"
            >
              {t("ai.processing.retry")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <SpinnerIcon aria-hidden className="h-10 w-10 animate-spin text-neon-pink" />
          <p className="text-lg font-semibold text-white">
            {processingStage === "removingBackground"
              ? t("ai.processing.removingBackground")
              : t("ai.processing.stylizing")}
          </p>
          <p className="text-sm text-ink-200">{t("ai.processing.hint")}</p>
        </div>
      )}
    </div>
  );
}
