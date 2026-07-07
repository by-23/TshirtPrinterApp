import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CircleCheck, Pencil, Sparkles, StarIcon, StarOutlineIcon, type IconProps } from "../../../components/icons.js";

export type AiStepKey = "photo" | "style" | "processing" | "result";

const STEPS: { key: AiStepKey; labelKey: string; Icon: ComponentType<IconProps> }[] = [
  { key: "photo", labelKey: "ai.steps.photo", Icon: Camera },
  { key: "style", labelKey: "ai.steps.style", Icon: Pencil },
  { key: "processing", labelKey: "ai.steps.processing", Icon: Sparkles },
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
    <div className="ai-steps" role="list" aria-label={t("ai.steps.style")}>
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const Icon = step.key === "result" && isActive ? StarIcon : step.Icon;
        const nodeClass = isDone ? "ai-steps-node--done" : isActive ? "ai-steps-node--active" : "ai-steps-node--idle";
        const labelClass = isDone ? "ai-steps-label--done" : isActive ? "ai-steps-label--active" : "ai-steps-label--idle";
        const connectorClass = isDone ? "ai-steps-connector--done" : "ai-steps-connector--idle";

        return (
          <div key={step.key} className="ai-steps-group" role="listitem">
            <div className="ai-steps-item">
              <div className={`ai-steps-node ${nodeClass}`}>
                {isDone ? (
                  <CircleCheck aria-hidden className="ai-steps-node-icon" />
                ) : (
                  <Icon aria-hidden className="ai-steps-node-icon" strokeWidth={1.8} />
                )}
              </div>
              <span className={`ai-steps-label ${labelClass}`}>{t(step.labelKey)}</span>
            </div>
            {index < STEPS.length - 1 ? <div aria-hidden className={`ai-steps-connector ${connectorClass}`} /> : null}
          </div>
        );
      })}
    </div>
  );
}
