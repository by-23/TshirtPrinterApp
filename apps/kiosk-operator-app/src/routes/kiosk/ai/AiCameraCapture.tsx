import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { Camera } from "../../../components/icons.js";

/**
 * "Сфотографироваться" flow — not covered by the reference mockups (only
 * the source-select/QR/style/result screens were provided), built in the
 * same visual language (dark card, neon-pink accent, pill buttons) per
 * `docs/PLAN.md` Этап 9.
 */
export function AiCameraCapture() {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState(false);
  const setStep = useAiFlowStore((state) => state.setStep);
  const setSourcePhoto = useAiFlowStore((state) => state.setSourcePhoto);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setError(true));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSourcePhoto(canvas.toDataURL("image/jpeg", 0.9));
    setStep("style");
  }

  return (
    <div className="flex h-full flex-col items-center gap-6 px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">{t("ai.camera.title")}</h1>
        <p className="mt-1 text-sm text-ink-200">{t("ai.camera.subtitle")}</p>
      </div>

      <div className="relative flex w-full max-w-md flex-1 items-center justify-center overflow-hidden rounded-3xl border-2 border-neon-pink bg-ink-900 shadow-neon-pink">
        {error ? (
          <p className="px-6 text-center text-sm text-ink-200">{t("ai.camera.error")}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        )}
      </div>

      <button
        type="button"
        onClick={handleCapture}
        disabled={error}
        aria-label={t("ai.camera.capture")}
        className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-pill border-4 border-white bg-neon-pink shadow-neon-pink transition-transform active:scale-95 disabled:opacity-40"
      >
        <Camera aria-hidden className="h-8 w-8 text-white" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={() => setStep("source")}
        className="text-sm font-semibold uppercase tracking-wide text-ink-200 underline-offset-4 hover:text-white hover:underline"
      >
        {t("common.back")}
      </button>
    </div>
  );
}
