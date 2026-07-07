import { z } from "zod";

/**
 * ИИ-раздел (Этап 9) — стиль из `point-server`'s `ai_styles` table, отдаётся
 * через `GET /ai/styles`. `key` — стабильный идентификатор для `POST
 * /ai/stylize` и для подбора превью-картинки на клиенте (см.
 * `kiosk-operator-app/src/routes/kiosk/ai`).
 */
export const aiStyleSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
});
export type AiStyle = z.infer<typeof aiStyleSchema>;

/**
 * Ответ `POST /ai/upload-session` (point-server) — QR на экране "Загрузка
 * фото" кодирует `uploadUrl`. В режиме `wifi` точка обслуживает её сама; в
 * режиме `relay` `uploadUrl` указывает на central-relay (см.
 * `UPLOAD_CREATE_SESSION_EVENT` ниже).
 */
export const createAiUploadSessionResponseSchema = z.object({
  sessionId: z.string(),
  uploadUrl: z.string(),
  expiresAt: z.string(),
});
export type CreateAiUploadSessionResponse = z.infer<typeof createAiUploadSessionResponseSchema>;

/** Body of `POST /ai/stylize` — полное фото (селфи/загрузка) + выбранный стиль. */
export const stylizeRequestSchema = z.object({
  imageBase64: z.string().min(1),
  styleKey: z.string().min(1),
});
export type StylizeRequest = z.infer<typeof stylizeRequestSchema>;

/** Response of `POST /ai/stylize` — стилизованное изображение (ещё с фоном, вырезание — на клиенте). */
export const stylizeResponseSchema = z.object({
  imageBase64: z.string().min(1),
});
export type StylizeResponse = z.infer<typeof stylizeResponseSchema>;

/**
 * Local (kiosk-facing) event on point-server's own Socket.IO — fired once a
 * phone photo arrives, regardless of `uploadMode` (`wifi`: uploaded directly
 * to point-server; `relay`: pushed down from central-relay, see
 * `UPLOAD_PHOTO_READY_EVENT`). The kiosk's `AiQrUpload` screen listens for
 * this on the same socket it already uses for order/point-config events.
 */
export const AI_PHOTO_RECEIVED_EVENT = "ai:photo-received";

export const aiPhotoReceivedPayloadSchema = z.object({
  sessionId: z.string(),
  imageBase64: z.string().min(1),
});
export type AiPhotoReceivedPayload = z.infer<typeof aiPhotoReceivedPayloadSchema>;

/**
 * `/relay-socket` events (same channel as `sync.ts`) used only in
 * `uploadMode: "relay"` — point-server asks central-relay to mint an
 * upload session (`UPLOAD_CREATE_SESSION_EVENT`, with ack), and later
 * receives the uploaded photo pushed back into its room
 * (`UPLOAD_PHOTO_READY_EVENT`) once a phone posts it to central-relay.
 */
export const UPLOAD_CREATE_SESSION_EVENT = "upload:create-session";
export const UPLOAD_PHOTO_READY_EVENT = "upload:photo-ready";

export const uploadCreateSessionAckSchema = z.object({
  ok: z.boolean(),
  token: z.string().optional(),
  uploadUrl: z.string().optional(),
  expiresAt: z.string().optional(),
  error: z.string().optional(),
});
export type UploadCreateSessionAck = z.infer<typeof uploadCreateSessionAckSchema>;

export const uploadPhotoReadyPayloadSchema = z.object({
  token: z.string(),
  imageBase64: z.string().min(1),
});
export type UploadPhotoReadyPayload = z.infer<typeof uploadPhotoReadyPayloadSchema>;
