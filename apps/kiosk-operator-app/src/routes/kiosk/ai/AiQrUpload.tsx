import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import type { CreateAiUploadSessionResponse } from "@tshirt/shared-types";
import { useAiFlowStore } from "../../../lib/aiFlowStore.js";
import { createAiUploadSession, subscribeAiPhotoReceived } from "../../../lib/pointServer.js";
import { Camera, Image, QrCode, SpinnerIcon, type IconProps } from "../../../components/icons.js";

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

/** Screen 2 ("Загрузка фото") — matches the reference mockup: QR + countdown + waiting spinner + 1-2-3 hint. */
export function AiQrUpload() {
  const { t } = useTranslation();
  const setStep = useAiFlowStore((state) => state.setStep);
  const setSourcePhoto = useAiFlowStore((state) => state.setSourcePhoto);
  const [session, setSession] = useState<CreateAiUploadSessionResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
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
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-4 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold uppercase tracking-wide text-white">{t("ai.qr.title")}</h1>
        <p className="mt-1 text-sm text-ink-200">{t("ai.qr.subtitle")}</p>
      </div>

      {error ? (
        <p className="w-full max-w-sm rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-center text-sm text-ink-200">
          {t("ai.qr.error")}
        </p>
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl border-2 border-neon-pink bg-ink-900 px-6 py-6 shadow-neon-pink">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-neon-pink">{t("ai.qr.scanTitle")}</h2>
          <p className="text-center text-xs text-ink-200">{t("ai.qr.scanSubtitle")}</p>
          <div className="flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3">
            {session ? (
              <QRCodeSVG value={session.uploadUrl} className="h-full w-full" />
            ) : (
              <SpinnerIcon aria-hidden className="h-8 w-8 animate-spin text-ink-900" />
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-200">
              {t("ai.qr.timerLabel")}
            </span>
            <span className="text-2xl font-extrabold leading-tight tabular-nums text-red-400">
              {formatCountdown(secondsLeft)}
            </span>
          </div>
          <p className="text-center text-xs text-ink-300">{t("ai.qr.sessionNote")}</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm font-semibold text-neon-cyan">
        <SpinnerIcon aria-hidden className="h-4 w-4 animate-spin text-neon-cyan" />
        {t("ai.qr.waiting")}
      </div>

      <div className="flex w-full max-w-sm justify-between gap-2">
        {STEP_ITEMS.map(({ n, Icon }) => (
          <div key={n} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-pill border border-white/20 text-xs font-bold text-white">
              {n}
            </div>
            <Icon aria-hidden className="h-5 w-5 text-ink-200" strokeWidth={1.6} />
            <span className="text-[11px] text-ink-200">{t(`ai.qr.steps.${n}`)}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setStep("camera")}
        className="text-sm font-semibold uppercase tracking-wide text-neon-cyan underline-offset-4 hover:underline"
      >
        {t("ai.qr.useCameraInstead")}
      </button>
    </div>
  );
}
