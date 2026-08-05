import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { fetchAiStyles } from "../../../lib/pointServer.js";
import { CircleCheck } from "../../../components/icons.js";
import { aiThemeSection } from "./themeSections.js";

/** Screen 4 ("Ваш дизайн готов") — matches the reference mockup: ДО/ПОСЛЕ toggle, bg-removed badge, 2 CTAs. */
export function AiResult() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sourcePhoto = useAiFlowStore((state) => state.sourcePhoto);
  const finalImage = useAiFlowStore((state) => state.finalImage);
  const selectedStyleKey = useAiFlowStore((state) => state.selectedStyleKey);
  const removeBackground = useAiFlowStore((state) => state.removeBackground);
  const restartStyleSelection = useAiFlowStore((state) => state.restartStyleSelection);
  const [showAfter, setShowAfter] = useState(true);
  const [styleLabel, setStyleLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedStyleKey) return;
    let cancelled = false;
    fetchAiStyles()
      .then((styles) => {
        if (cancelled) return;
        const match = styles.find((style) => style.key === selectedStyleKey);
        setStyleLabel(match?.label ?? selectedStyleKey);
      })
      .catch(() => {
        if (!cancelled) setStyleLabel(selectedStyleKey);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStyleKey]);

  if (!finalImage) return null;

  return (
    <div className="ai-result-screen" {...aiThemeSection("resultScreen")}>
      <div className="ai-result-header" {...aiThemeSection("resultHeader")}>
        <h1 className="ai-result-header-title">{t("ai.result.title")}</h1>
        <p className="ai-result-header-subtitle">
          {styleLabel
            ? t("ai.result.styleLine", { style: styleLabel })
            : removeBackground
              ? t("ai.result.subtitle")
              : t("ai.result.subtitleNoBg")}
        </p>
      </div>

      <div className="ai-result-content">
        <div className="ai-result-preview" {...aiThemeSection("resultPreview")}>
          <img
            src={showAfter ? finalImage : (sourcePhoto ?? finalImage)}
            alt=""
            className="ai-result-preview-image"
          />
        </div>

        <div
          className="ai-result-toggle"
          role="group"
          aria-label={t("ai.result.before")}
          {...aiThemeSection("resultToggle")}
        >
          <button
            type="button"
            onClick={() => setShowAfter(false)}
            className={`ai-result-toggle-btn${!showAfter ? " ai-result-toggle-btn--active" : ""}`}
          >
            {t("ai.result.before")}
          </button>
          <button
            type="button"
            onClick={() => setShowAfter(true)}
            className={`ai-result-toggle-btn${showAfter ? " ai-result-toggle-btn--active" : ""}`}
          >
            {t("ai.result.after")}
          </button>
        </div>

        {removeBackground ? (
          <div className="ai-result-status-wrap" {...aiThemeSection("resultStatus")}>
            <div className="ai-result-status">
              <div className="ai-result-status-thumb-wrap">
                <img src={finalImage} alt="" className="ai-result-status-thumb" />
              </div>
              <div className="ai-result-status-text">
                <span className="ai-result-status-title">{t("ai.result.bgRemovedTitle")}</span>
                <span className="ai-result-status-subtitle">{t("ai.result.bgRemovedSubtitle")}</span>
              </div>
              <CircleCheck aria-hidden className="ai-result-status-check" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="ai-result-actions" {...aiThemeSection("resultButtons")}>
        <button
          type="button"
          onClick={() => navigate("/kiosk/editor?category=ai_style")}
          className="ai-result-primary-btn"
        >
          {t("ai.result.editOnShirt")}
        </button>
        <button
          type="button"
          onClick={restartStyleSelection}
          className="ai-result-secondary-btn"
        >
          {t("ai.result.pickAnotherStyle")}
        </button>
      </div>

      <p className="ai-result-info-bar" {...aiThemeSection("resultInfo")}>
        <span className="ai-result-info-icon" aria-hidden>
          i
        </span>
        {t("ai.result.infoBar")}
      </p>
    </div>
  );
}
