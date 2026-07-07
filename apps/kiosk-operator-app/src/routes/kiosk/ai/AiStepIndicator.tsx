import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CircleCheck, Pencil, Settings, StarIcon, StarOutlineIcon, type IconProps } from "../../../components/icons.js";

export type AiStepKey = "photo" | "style" | "processing" | "result";

const STEPS: { key: AiStepKey; labelKey: string; Icon: ComponentType<IconProps> }[] = [
  { key: "photo", labelKey: "ai.steps.photo", Icon: Camera },
  { key: "style", labelKey: "ai.steps.style", Icon: Pencil },
  { key: "processing", labelKey: "ai.steps.processing", Icon: Settings },
  { key: "result", labelKey: "ai.steps.result", Icon: StarOutlineIcon },
];

export interface AiStepIndicatorProps {
  current: AiStepKey;
}

/** 4-step progress strip (Фото/Стиль/Обработка/Результат) reused on the style-select and result screens. */
export function AiStepIndicator({ current }: AiStepIndicatorProps) {
  const { t } = useTranslation();
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <div className="flex items-center justify-center">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const Icon = step.key === "result" && isActive ? StarIcon : step.Icon;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  isDone
                    ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
                    : isActive
                      ? "border-neon-pink bg-neon-pink/15 text-neon-pink"
                      : "border-white/20 text-white/40"
                }`}
              >
                {isDone ? <CircleCheck className="h-5 w-5" /> : <Icon aria-hidden className="h-4 w-4" strokeWidth={1.8} />}
              </div>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide ${
                  isActive || isDone ? "text-white" : "text-white/40"
                }`}
              >
                {t(step.labelKey)}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                aria-hidden
                className={`mx-2 mb-4 h-0.5 w-8 flex-shrink-0 sm:w-14 ${isDone ? "bg-neon-pink" : "bg-white/15"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
