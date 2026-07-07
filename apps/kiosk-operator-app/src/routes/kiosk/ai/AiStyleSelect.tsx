import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AiStyle } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { fetchAiStyles, resolveDesignImageUrl } from "../../../lib/pointServer.js";
import { AiStepIndicator } from "./AiStepIndicator.js";
import { CircleCheck } from "../../../components/icons.js";

/** Screen 3 ("Выберите стиль") — matches the reference mockup: photo preview, step indicator, 3 style cards. */
export function AiStyleSelect() {
  const { t } = useTranslation();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
  const setSelectedStyleKey = useAiFlowStore((state) => state.setSelectedStyleKey);
  const removeBackground = useAiFlowStore((state) => state.removeBackground);
  const setRemoveBackground = useAiFlowStore((state) => state.setRemoveBackground);
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
    <div className="ai-style-screen">
      <div className="ai-style-header">
        <h1 className="ai-style-header-title">{t("ai.style.title")}</h1>
        <p className="ai-style-header-subtitle">{t("ai.style.subtitle")}</p>
      </div>

      <div className="ai-style-photo-row">
        <span className="ai-style-photo-badge">
          {t("ai.style.photoLoaded")}
          <CircleCheck aria-hidden className="ai-style-photo-badge-icon" />
        </span>
        {sourcePhoto ? <img src={sourcePhoto} alt="" className="ai-style-photo" /> : null}
      </div>

      <AiStepIndicator current="style" />

      {error ? <p className="ai-style-error">{error}</p> : null}

      <label className="ai-style-bg-option">
        <input
          type="checkbox"
          checked={removeBackground}
          onChange={(event) => setRemoveBackground(event.target.checked)}
          className="ai-style-bg-option-input"
        />
        <span className="ai-style-bg-option-surface">
          <span className="ai-style-bg-option-mark" aria-hidden>
            <CircleCheck className="ai-style-bg-option-mark-icon" />
          </span>
          <span className="ai-style-bg-option-label">{t("ai.style.removeBackground")}</span>
        </span>
      </label>

      <div className="ai-style-cards">
        {styles.map((style) => {
          const selected = style.key === selectedStyleKey;
          return (
            <button
              key={style.key}
              type="button"
              onClick={() => setSelectedStyleKey(style.key)}
              className={`ai-style-card${selected ? " ai-style-card--selected" : ""}`}
            >
              <span className="ai-style-card-title">{style.label}</span>
              <img className="ai-style-card-preview" src={resolveDesignImageUrl(style.previewUrl)} alt="" />
              <span className="ai-style-card-desc">{style.description}</span>
            </button>
          );
        })}
        {loadError ? <p className="ai-style-load-error">{t("ai.style.loadError")}</p> : null}
      </div>

      <div className="ai-style-footer">
        <button type="button" onClick={() => setStep("source")} className="ai-style-back-btn">
          {t("common.back")}
        </button>
        <button
          type="button"
          onClick={() => setStep("processing")}
          disabled={!selectedStyleKey}
          className="ai-style-stylize-btn"
        >
          {t("ai.style.stylize")}
        </button>
      </div>
    </div>
  );
}
