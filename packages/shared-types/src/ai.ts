import { z } from "zod";

/**
 * ИИ-раздел (Этап 9) — стиль из `point-server`'s `ai_styles` table, отдаётся
 * через `GET /ai/styles`. `key` — стабильный идентификатор для `POST
 * /ai/stylize`. `previewUrl` — заранее отрендеренная превью-миниатюра
 * (см. `point-server/src/modules/ai/local/previewCache.ts`), `/files/...`
 * путь, резолвится на клиенте через `resolveDesignImageUrl` (несмотря на
 * название, эта функция общая для любых `/files/...` путей).
 */
export const aiStyleSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  previewUrl: z.string(),
});
export type AiStyle = z.infer<typeof aiStyleSchema>;

/**
 * Локальные (офлайн) движки стилизации — используются как фолбэк, когда
 * Pollinations недоступен (см. `point-server/src/modules/ai/local/index.ts`).
 * Формат `{kind}:{variant}`. Список используется и для валидации на
 * бэкенде, и для выпадающего списка в админке ("ИИ-стили").
 */
export const AI_LOCAL_ENGINE_KEYS = [
  "animegan:hayao",
  "animegan:shinkai",
  "animegan:paprika",
  "animegan:facepaint",
  "fast-neural-style:mosaic",
  "fast-neural-style:candy",
  "fast-neural-style:rain-princess",
  "fast-neural-style:udnie",
  "fast-neural-style:pointilism",
  "filter:noir",
  "filter:sepia",
  "filter:popArt",
  "filter:pencilSketch",
] as const;
export type AiLocalEngineKey = (typeof AI_LOCAL_ENGINE_KEYS)[number];

/**
 * Полная запись стиля (вкл. отключённые), для операторской панели
 * "ИИ-стили" — `GET /ai/styles/admin` (см. `point-server/src/modules/ai/routes.ts`).
 * В отличие от `aiStyleSchema`, отдаёт `promptTemplate`/`engineKey`, чтобы
 * их можно было редактировать.
 */
export const aiStyleAdminSchema = z.object({
  id: z.number(),
  key: z.string(),
  label: z.string(),
  description: z.string(),
  promptTemplate: z.string(),
  engineKey: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  previewUrl: z.string(),
});
export type AiStyleAdmin = z.infer<typeof aiStyleAdminSchema>;

/** Body of `POST /ai/styles` — `key` is immutable once created. */
export const createAiStyleInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "key must be lowercase letters, digits or underscores"),
  label: z.string().min(1),
  description: z.string().min(1),
  promptTemplate: z.string().min(1),
  engineKey: z.string().min(1),
  sortOrder: z.number().optional(),
  enabled: z.boolean().optional(),
});
export type CreateAiStyleInput = z.infer<typeof createAiStyleInputSchema>;

/** Body of `PATCH /ai/styles/:id` — every field optional, `key` intentionally excluded (immutable). */
export const updateAiStyleInputSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  promptTemplate: z.string().min(1).optional(),
  engineKey: z.string().min(1).optional(),
  sortOrder: z.number().optional(),
  enabled: z.boolean().optional(),
});
export type UpdateAiStyleInput = z.infer<typeof updateAiStyleInputSchema>;

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
