import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { FabricImage, type Canvas } from "fabric";
import type { CreateAiUploadSessionResponse } from "@tshirt/shared-types";
import { createAiUploadSession, subscribeAiPhotoReceived } from "../../lib/pointServer.js";
import { placeImageCentered } from "../canvasImage.js";
import { SpinnerIcon } from "../../components/icons.js";

export interface UploadToolProps {
  canvas: Canvas | null;
}

const SESSION_SECONDS = 15 * 60;

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * "Загрузить" toolbar tool — QR-only photo upload (decision: no local file
 * picker fallback), reusing the exact same session/socket plumbing as the
 * ИИ-раздел's `AiQrUpload.tsx` (`createAiUploadSession` +
 * `subscribeAiPhotoReceived`, see `pointServer.ts`). A photo landing here
 * just goes straight onto the canvas — no background removal, that stays
 * exclusive to the ИИ flow.
 */
export function UploadTool({ canvas }: UploadToolProps) {
  const { t } = useTranslation();
  const [session, setSession] = useState<CreateAiUploadSessionResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);
  const [error, setError] = useState(false);
  const [received, setReceived] = useState(false);

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
    if (!session || !canvas) return;
    return subscribeAiPhotoReceived((payload) => {
      if (payload.sessionId !== session.sessionId) return;
      setReceived(true);
      void FabricImage.fromURL(payload.imageBase64).then((image) => placeImageCentered(canvas, image));
    });
  }, [session, canvas]);

  return (
    <div className="editor-tool-panel items-center">
      <h4 className="editor-tool-title w-full">{t("editor.toolbar.uploadPhoto")}</h4>

      {received ? (
        <p className="editor-tool-body py-6 text-center font-semibold text-white">{t("editor.toolbar.uploadQr.received")}</p>
      ) : (
        <>
          <p className="editor-tool-caption text-center text-ink-300">{t("editor.toolbar.uploadQr.subtitle")}</p>
          <div className="editor-tool-qr-box flex items-center justify-center rounded-2xl bg-white p-4">
            {error ? (
              <p className="editor-tool-caption text-center font-semibold text-red-600">{t("ai.qr.error")}</p>
            ) : session ? (
              <QRCodeSVG value={session.uploadUrl} className="h-full w-full" />
            ) : (
              <SpinnerIcon aria-hidden className="h-12 w-12 animate-spin text-ink-900" />
            )}
          </div>
          {session && (
            <span className="editor-tool-body font-mono font-bold tabular-nums text-white">{formatCountdown(secondsLeft)}</span>
          )}
          <p className="editor-tool-caption text-center text-ink-400">{t("editor.toolbar.uploadQr.waiting")}</p>
        </>
      )}
    </div>
  );
}
