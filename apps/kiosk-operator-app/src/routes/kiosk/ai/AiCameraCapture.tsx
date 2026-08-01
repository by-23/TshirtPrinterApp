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
    <div className="flex h-full w-full flex-col items-center bg-black px-4 py-6">
      <div className="flex-shrink-0 text-center">
        <h1 className="text-4xl font-extrabold uppercase tracking-wide text-white">{t("ai.camera.title")}</h1>
        <p className="mt-2 text-xl text-ink-200">{t("ai.camera.subtitle")}</p>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        <div className="relative aspect-[9/16] h-[min(100%,70%)] w-auto max-w-full overflow-hidden rounded-3xl border-2 border-neon-pink bg-ink-900 shadow-neon-pink">
          {error ? (
            <div className="flex h-full w-full items-center justify-center px-6">
              <p className="text-center text-sm text-ink-200">{t("ai.camera.error")}</p>
            </div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          )}
        </div>

        <div className="mt-8 flex flex-shrink-0 flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleCapture}
            disabled={error}
            aria-label={t("ai.camera.capture")}
            className="flex h-28 w-28 items-center justify-center rounded-pill border-4 border-white bg-neon-pink shadow-neon-pink transition-transform active:scale-95 disabled:opacity-40"
          >
            <Camera aria-hidden className="h-12 w-12 text-white" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => setStep("source")}
            className="text-2xl font-semibold uppercase tracking-wide text-ink-200 underline-offset-4 hover:text-white hover:underline"
          >
            {t("common.back")}
          </button>
        </div>
      </div>
    </div>
  );
}
