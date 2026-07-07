import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import type { AiStyle } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { fetchAiStyles } from "../../../lib/pointServer.js";
import { AiStepIndicator } from "./AiStepIndicator.js";
import { Camera, CircleCheck, FlameIcon, Sparkles, type IconProps } from "../../../components/icons.js";

interface StyleVisual {
  gradient: string;
  Icon: ComponentType<IconProps>;
}

/** Bundled placeholder visuals per style `key` (no real preview art licensed yet — see docs/PLAN.md Этап 9). */
const STYLE_VISUALS: Record<string, StyleVisual> = {
  gta: { gradient: "from-orange-500 via-pink-600 to-purple-800", Icon: FlameIcon },
  anime: { gradient: "from-pink-500 via-fuchsia-600 to-purple-800", Icon: Sparkles },
  noir: { gradient: "from-slate-500 via-slate-700 to-black", Icon: Camera },
};
const DEFAULT_STYLE_VISUAL: StyleVisual = { gradient: "from-ink-700 via-ink-800 to-ink-900", Icon: Sparkles };

/** Screen 3 ("Выберите стиль") — matches the reference mockup: photo preview, step indicator, 3 style cards. */
export function AiStyleSelect() {
  const { t } = useTranslation();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
  const setSelectedStyleKey = useAiFlowStore((state) => state.setSelectedStyleKey);
  const setStep = useAiFlowStore((state) => state.setStep);
  const error = useAiFlowStore((state) => state.error);
  const [styles, setStyles] = useState<AiStyle[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAiStyles()
      .then((result) => {
        if (!cancelled) setStyles(result);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">{t("ai.style.title")}</h1>
        <p className="mt-1 text-sm text-ink-200">{t("ai.style.subtitle")}</p>
      </div>

      <div className="flex w-full max-w-2xl items-center gap-4">
        {sourcePhoto && (
          <img
            src={sourcePhoto}
            alt=""
            className="h-28 w-28 flex-shrink-0 rounded-2xl border border-white/10 object-cover sm:h-32 sm:w-32"
          />
        )}
        <span className="flex items-center gap-1.5 rounded-pill border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
          {t("ai.style.photoLoaded")}
          <CircleCheck aria-hidden className="h-4 w-4" />
        </span>
      </div>

      <AiStepIndicator current="style" />

      {error && (
        <p className="w-full max-w-2xl rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3 sm:items-stretch">
        {styles.map((style) => {
          const visual = STYLE_VISUALS[style.key] ?? DEFAULT_STYLE_VISUAL;
          const Icon = visual.Icon;
          const selected = style.key === selectedStyleKey;
          return (
            <button
              key={style.key}
              type="button"
              onClick={() => setSelectedStyleKey(style.key)}
              className={`flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border-2 text-center transition-transform active:scale-[0.98] ${
                selected ? "border-neon-pink shadow-neon-pink" : "border-white/10"
              }`}
            >
              <div className={`flex flex-1 flex-col items-center justify-between gap-2 bg-gradient-to-br px-3 pb-4 pt-3 ${visual.gradient}`}>
                <span className="text-sm font-extrabold uppercase tracking-wide text-white">{style.label}</span>
                <Icon aria-hidden className="h-12 w-12 text-white/90" strokeWidth={1.4} />
              </div>
              <div className="bg-ink-950 px-3 py-2.5">
                <span className="text-xs text-ink-200">{style.description}</span>
              </div>
            </button>
          );
        })}
        {loadError && <p className="col-span-full text-center text-sm text-ink-200">{t("ai.style.loadError")}</p>}
      </div>

      <div className="flex w-full max-w-2xl items-center gap-3">
        <button
          type="button"
          onClick={() => setStep("source")}
          className="flex-1 rounded-pill bg-ink-800 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-ink-700"
        >
          {t("common.back")}
        </button>
        <button
          type="button"
          onClick={() => setStep("processing")}
          disabled={!selectedStyleKey}
          className="flex-[2] rounded-pill bg-neon-pink px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-neon-pink transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {t("ai.style.stylize")}
        </button>
      </div>
    </div>
  );
}
