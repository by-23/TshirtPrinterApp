import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { AiStepIndicator } from "./AiStepIndicator.js";
import { CircleCheck } from "../../../components/icons.js";

/** Screen 4 ("Ваш дизайн готов") — matches the reference mockup: ДО/ПОСЛЕ toggle, bg-removed badge, 2 CTAs. */
export function AiResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const finalImage = useAiFlowStore((state) => state.finalImage);
  const restartStyleSelection = useAiFlowStore((state) => state.restartStyleSelection);
  const [showAfter, setShowAfter] = useState(true);

  if (!finalImage) return null;

  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">{t("ai.result.title")}</h1>
        <p className="mt-1 text-sm text-ink-200">{t("ai.result.subtitle")}</p>
      </div>

      <AiStepIndicator current="result" />

      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="flex h-72 w-full items-center justify-center overflow-hidden rounded-3xl bg-ink-900">
          <img
            src={showAfter ? finalImage : (sourcePhoto ?? finalImage)}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>

        <div className="flex overflow-hidden rounded-pill border border-white/15">
          <button
            type="button"
            onClick={() => setShowAfter(false)}
            className={`px-6 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
              !showAfter ? "bg-white/10 text-white" : "text-ink-200"
            }`}
          >
            {t("ai.result.before")}
          </button>
          <button
            type="button"
            onClick={() => setShowAfter(true)}
            className={`px-6 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
              showAfter ? "bg-neon-pink text-white" : "text-ink-200"
            }`}
          >
            {t("ai.result.after")}
          </button>
        </div>

        <div className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-ink-900 px-4 py-3">
          <img src={finalImage} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold text-white">{t("ai.result.bgRemovedTitle")}</span>
            <span className="text-xs text-ink-200">{t("ai.result.bgRemovedSubtitle")}</span>
          </div>
          <CircleCheck aria-hidden className="h-5 w-5 flex-shrink-0 text-emerald-400" />
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate("/kiosk/editor?category=ai_style")}
          className="rounded-pill bg-neon-pink px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-neon-pink transition-transform active:scale-[0.98]"
        >
          {t("ai.result.editOnShirt")}
        </button>
        <button
          type="button"
          onClick={restartStyleSelection}
          className="rounded-pill border border-white/15 bg-ink-900 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-ink-800"
        >
          {t("ai.result.pickAnotherStyle")}
        </button>
      </div>

      <p className="max-w-sm text-center text-xs text-ink-300">ⓘ {t("ai.result.infoBar")}</p>
    </div>
  );
}
