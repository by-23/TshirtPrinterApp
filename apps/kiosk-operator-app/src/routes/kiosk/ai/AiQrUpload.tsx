import { Fragment, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import type { CreateAiUploadSessionResponse } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { createAiUploadSession, subscribeAiPhotoReceived } from "../../../lib/pointServer.js";
import { Camera, Image, QrCode, SpinnerIcon, type IconProps } from "../../../components/icons.js";
import { blockBorderStyle, cardGradientStyle, contentBoxStyle } from "./borderStyle.js";
import { aiThemeSection } from "./themeSections.js";

const SESSION_SECONDS = 15 * 60;
const WAITING_DOT_COUNT = 12;

const STEP_ITEMS: { n: 1 | 2 | 3; Icon: ComponentType<IconProps> }[] = [
  { n: 1, Icon: Camera },
  { n: 2, Icon: QrCode },
  { n: 3, Icon: Image },
];

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function WaitingDotsSpinner() {
  return (
    <span className="ai-qr-waiting-spinner" aria-hidden>
      {Array.from({ length: WAITING_DOT_COUNT }, (_, index) => (
        <span
          key={index}
          className="ai-qr-waiting-dot"
          style={{ "--dot-index": index } as CSSProperties}
        />
      ))}
    </span>
  );
}

/** Screen 2 ("Загрузка фото") — matches the reference mockup: QR + countdown + waiting spinner + 1-2-3 hint. */
export function AiQrUpload() {
  const { t } = useTranslation();
  const setStep = useAiFlowStore((state) => state.setStep);
  const setSourcePhoto = useAiFlowStore((state) => state.setSourcePhoto);
  const [session, setSession] = useState<CreateAiUploadSessionResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createAiUploadSession()
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        setSecondsLeft(Math.max(0, Math.round((new Date(result.expiresAt).getTime() - Date.now()) / 1000)));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    return subscribeAiPhotoReceived((payload) => {
      if (payload.sessionId !== session.sessionId) return;
      setSourcePhoto(payload.imageBase64);
      setStep("style");
    });
  }, [session, setSourcePhoto, setStep]);

  return (
    <div className="ai-qr-screen" {...aiThemeSection("qrScreen")}>
      <div className="ai-qr-header" {...aiThemeSection("qrHeader")}>
        <h1 className="ai-qr-header-title">{t("ai.qr.title")}</h1>
        <p className="ai-qr-header-subtitle">{t("ai.qr.subtitle")}</p>
      </div>

      <div className="ai-qr-main">
        <div
          className="ai-qr-card"
          {...aiThemeSection("qrCard")}
          style={{
            ...cardGradientStyle("card"),
            gap: "var(--ai-qr-card-gap)",
            ...blockBorderStyle("card"),
          }}
        >
          <h2 className="ai-qr-scan-title">{t("ai.qr.scanTitle")}</h2>
          <p className="ai-qr-scan-subtitle">{t("ai.qr.scanSubtitle")}</p>

          <div
            className="ai-qr-code-wrap"
            {...aiThemeSection("qrCode")}
            style={{
              width: "var(--ai-qr-code-size)",
              height: "var(--ai-qr-code-size)",
              borderRadius: "var(--ai-qr-code-radius)",
              padding: "var(--ai-qr-code-padding)",
            }}
          >
            {error ? (
              <p className="ai-qr-error">{t("ai.qr.error")}</p>
            ) : session ? (
              <QRCodeSVG value={session.uploadUrl} className="h-full w-full" />
            ) : (
              <SpinnerIcon aria-hidden className="h-12 w-12 animate-spin text-ink-900" />
            )}
          </div>

          <div
            className="flex flex-col items-center"
            {...aiThemeSection("qrTimer")}
            style={contentBoxStyle("timer-box")}
          >
            <span
              className="text-center font-semibold uppercase tracking-wide"
              style={{ fontSize: "var(--ai-qr-timer-label-size)", color: "var(--ai-qr-timer-label-color)" }}
            >
              {t("ai.qr.timerLabel")}
            </span>
            <span
              className="font-extrabold tabular-nums leading-none"
              style={{ fontSize: "var(--ai-qr-timer-value-size)", color: "var(--ai-qr-timer-value-color)" }}
            >
              {formatCountdown(secondsLeft)}
            </span>
          </div>

          <p className="ai-qr-note">{t("ai.qr.sessionNote")}</p>
        </div>
      </div>

      <div className="ai-qr-footer">
        <div className="ai-qr-footer-guide">
          <div className="ai-qr-waiting" {...aiThemeSection("qrWaiting")}>
            <WaitingDotsSpinner />
            {t("ai.qr.waiting")}
          </div>

          <div className="ai-qr-steps-wrap" {...aiThemeSection("qrSteps")}>
          <div className="ai-qr-steps-numbers">
            {STEP_ITEMS.map(({ n }, index) => (
              <Fragment key={n}>
                {index > 0 ? <div className="ai-qr-step-number-connector" aria-hidden /> : null}
                <div className="ai-qr-step-number-cell">
                  <div className="ai-qr-step-badge">{n}</div>
                </div>
              </Fragment>
            ))}
          </div>

          <div className="ai-qr-steps-block" style={blockBorderStyle("steps-block")}>
            <div className="ai-qr-steps">
              {STEP_ITEMS.map(({ n, Icon }, index) => (
                <Fragment key={n}>
                  {index > 0 ? <div className="ai-qr-step-divider" aria-hidden /> : null}
                  <div className="ai-qr-step-item">
                    <Icon aria-hidden className="ai-qr-step-icon" strokeWidth={1.6} />
                    <span className="ai-qr-step-label">{t(`ai.qr.steps.${n}`)}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
        </div>

        <button
          type="button"
          onClick={() => setStep("camera")}
          className="ai-qr-camera-link"
          {...aiThemeSection("qrCameraLink")}
        >
          {t("ai.qr.useCameraInstead")}
        </button>
      </div>
    </div>
  );
}
