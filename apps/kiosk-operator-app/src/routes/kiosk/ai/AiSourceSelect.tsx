import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import cameraIcon from "../../../assets/ai-source-camera.png";
import phoneUploadIcon from "../../../assets/ai-source-phone-upload.png";
import { aiThemeSection } from "./themeSections.js";

function TintedIcon({ src, className }: { src: string; className?: string }) {
  const maskStyle = {
    WebkitMaskImage: `url(${src})`,
    maskImage: `url(${src})`,
  } satisfies CSSProperties;

  return (
    <span
      aria-hidden
      className={`ai-source-card-icon ai-source-card-icon-mask ${className ?? ""}`}
      style={maskStyle}
    />
  );
}

/** Screen 1 ("ИИ-СТИЛЬ") — matches the reference mockup: camera vs phone-QR source cards. */
export function AiSourceSelect() {
  const { t } = useTranslation();
  const setStep = useAiFlowStore((state) => state.setStep);

  return (
    <div className="ai-source-screen">
      <div className="ai-source-header" {...aiThemeSection("sourceTitle")}>
        <h1 className="ai-source-header-title">{t("ai.source.title")}</h1>
        <p className="ai-source-header-subtitle">{t("ai.source.subtitle")}</p>
      </div>

      <div className="ai-source-cards" {...aiThemeSection("sourceGrid")}>
        <button
          type="button"
          onClick={() => setStep("camera")}
          className="ai-source-card ai-source-card--camera"
          {...aiThemeSection("cameraCard")}
        >
          <span className="ai-source-card-title">{t("ai.source.cameraTitle")}</span>
          <div className="ai-source-card-icon-wrap">
            <TintedIcon src={cameraIcon} />
          </div>
          <span className="ai-source-card-subtitle">{t("ai.source.cameraSubtitle")}</span>
        </button>

        <button
          type="button"
          onClick={() => setStep("qr")}
          className="ai-source-card ai-source-card--phone"
          {...aiThemeSection("phoneCard")}
        >
          <span className="ai-source-card-title">{t("ai.source.phoneTitle")}</span>
          <div className="ai-source-card-icon-wrap">
            <TintedIcon src={phoneUploadIcon} />
          </div>
          <span className="ai-source-card-subtitle">{t("ai.source.phoneSubtitle")}</span>
        </button>
      </div>
    </div>
  );
}
