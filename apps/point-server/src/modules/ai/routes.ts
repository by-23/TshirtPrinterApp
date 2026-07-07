import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  stylizeRequestSchema,
  createAiStyleInputSchema,
  updateAiStyleInputSchema,
  UPLOAD_CREATE_SESSION_EVENT,
  type UploadCreateSessionAck,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { pointConfig } from "../../db/schema.js";
import { env } from "../../env.js";
import { getSyncSocket } from "../sync/client.js";
import { emitAiPhotoReceivedEvent } from "../../realtime/socket.js";
import {
  getEnabledStyles,
  getStyleByKey,
  getAllStylesAdmin,
  getStyleById,
  createStyle,
  updateStyleById,
  deleteStyleById,
} from "./styles.js";
import { createWifiUploadSession, isWifiUploadSessionUsable, consumeWifiUploadSession } from "./uploadSessions.js";
import { renderUploadPage } from "./uploadPage.js";
import { looksLikeHeic, convertHeicToJpeg } from "./heic.js";
import { stylizeWithPollinations } from "./pollinations.js";
import { stylizeLocally } from "./local/index.js";
import { regeneratePreview } from "./local/previewCache.js";

const POINT_CONFIG_ROW_ID = 1;
/** Longest side a phone photo is downscaled to before being emitted as base64 (wifi mode; relay mode is resized by central-relay instead). */
const MAX_PHOTO_DIMENSION_PX = 1600;
const RELAY_SESSION_TIMEOUT_MS = 10_000;

/** Fail-open default matches `configRoutes`' `FAIL_OPEN_POINT_CONFIG` — a point that never synced yet behaves as `relay`. */
async function getUploadMode(): Promise<"relay" | "wifi"> {
  const [row] = await db
    .select({ uploadMode: pointConfig.uploadMode })
    .from(pointConfig)
    .where(eq(pointConfig.id, POINT_CONFIG_ROW_ID));
  return row?.uploadMode ?? "relay";
}

/**
 * ИИ-раздел (Этап 9) — photo source (camera capture happens entirely in the
 * kiosk browser and never touches these routes), style catalog and
 * Pollinations stylization. See `docs/PLAN.md` Этап 9 and the plan's
 * architecture diagram for how `uploadMode: "relay"` vs `"wifi"` differ.
 */
export async function aiRoutes(app: FastifyInstance) {
  app.get("/ai/styles", async () => {
    return getEnabledStyles();
  });

  // --- "ИИ-стили" operator panel (admin CRUD over the ai_styles catalog) ---

  app.get("/ai/styles/admin", async () => {
    return getAllStylesAdmin();
  });

  app.post("/ai/styles", async (request, reply) => {
    const parsed = createAiStyleInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = await createStyle(parsed.data);
    if ("error" in result) {
      return reply.status(409).send(result);
    }
    return reply.status(201).send(result);
  });

  app.patch<{ Params: { id: string } }>("/ai/styles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const parsed = updateAiStyleInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }
    const updated = await updateStyleById(id, parsed.data);
    if (!updated) {
      return reply.status(404).send({ error: "Style not found" });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/ai/styles/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const deleted = await deleteStyleById(id);
    if (!deleted) {
      return reply.status(404).send({ error: "Style not found" });
    }
    return reply.status(204).send();
  });

  app.post<{ Params: { id: string } }>("/ai/styles/:id/regenerate-preview", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const style = await getStyleById(id);
    if (!style) {
      return reply.status(404).send({ error: "Style not found" });
    }
    try {
      await regeneratePreview(style.key, style.engineKey);
      return { ok: true };
    } catch (err) {
      request.log.error(err, "Failed to regenerate AI style preview");
      return reply.status(500).send({ error: "Failed to regenerate preview" });
    }
  });

  app.post("/ai/upload-session", async (request, reply) => {
    const uploadMode = await getUploadMode();

    if (uploadMode === "wifi") {
      const session = createWifiUploadSession();
      return {
        sessionId: session.token,
        // `PUBLIC_LAN_HOST` (when set) wins over the request's own `Host` —
        // the kiosk frontend always calls point-server over a fixed
        // `localhost:PORT` (see `POINT_SERVER_URL`), so `request.headers.host`
        // is never a phone-reachable address on a real point (see
        // docs/PLAN.md Этап 9 "Известные ограничения").
        uploadUrl: `${request.protocol}://${env.PUBLIC_LAN_HOST ?? request.headers.host}/ai/upload/${session.token}`,
        expiresAt: session.expiresAt,
      };
    }

    const socket = getSyncSocket();
    if (!socket?.connected) {
      return reply.status(503).send({ error: "Central-relay unavailable — try the kiosk camera instead" });
    }

    try {
      const ack = (await socket
        .timeout(RELAY_SESSION_TIMEOUT_MS)
        .emitWithAck(UPLOAD_CREATE_SESSION_EVENT, {})) as UploadCreateSessionAck;
      if (!ack.ok || !ack.token || !ack.uploadUrl || !ack.expiresAt) {
        throw new Error(ack.error ?? "central-relay rejected the upload session request");
      }
      return { sessionId: ack.token, uploadUrl: ack.uploadUrl, expiresAt: ack.expiresAt };
    } catch (err) {
      request.log.warn(err, "Failed to create relay upload session");
      return reply.status(503).send({ error: "Central-relay unavailable — try the kiosk camera instead" });
    }
  });

  // wifi-mode only — the phone is assumed to be reachable directly (same
  // network/AP as the point), so this server serves the upload page itself
  // instead of delegating to central-relay.
  app.get<{ Params: { sessionId: string } }>("/ai/upload/:sessionId", async (request, reply) => {
    if (!isWifiUploadSessionUsable(request.params.sessionId)) {
      return reply.status(410).type("text/html").send("<p>Ссылка недействительна или истекла.</p>");
    }
    return reply.type("text/html").send(renderUploadPage(request.params.sessionId));
  });

  app.post<{ Params: { sessionId: string } }>("/ai/upload/:sessionId/photo", async (request, reply) => {
    if (!isWifiUploadSessionUsable(request.params.sessionId)) {
      return reply.status(410).send({ error: "Upload session expired or already used" });
    }

    // `request.file()` itself can throw (malformed multipart, size limit,
    // aborted upload, etc.) — kept inside the try/catch (unlike before) so
    // every failure mode is logged and reported the same way, instead of
    // some falling through to Fastify's generic unhandled-rejection 500.
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "Missing photo" });
      }

      const rawBuffer = await file.toBuffer();
      request.log.info(
        { filename: file.filename, mimetype: file.mimetype, bytes: rawBuffer.length },
        "Received phone photo upload",
      );

      const sharpInput = looksLikeHeic(rawBuffer, file.filename, file.mimetype)
        ? await convertHeicToJpeg(rawBuffer)
        : rawBuffer;
      const resized = await sharp(sharpInput)
        .rotate()
        .resize(MAX_PHOTO_DIMENSION_PX, MAX_PHOTO_DIMENSION_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageBase64 = `data:image/jpeg;base64,${resized.toString("base64")}`;

      consumeWifiUploadSession(request.params.sessionId);
      emitAiPhotoReceivedEvent({ sessionId: request.params.sessionId, imageBase64 });

      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, "Failed to process uploaded photo");
      // Surfaced verbatim on the phone's upload page (see `uploadPage.ts`)
      // so failures can be diagnosed from the field without server log access.
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: "Failed to process photo", message });
    }
  });

  app.post("/ai/stylize", async (request, reply) => {
    const parsed = stylizeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const style = await getStyleByKey(parsed.data.styleKey);
    if (!style || !style.enabled) {
      return reply.status(400).send({ error: "Unknown or disabled style" });
    }

    try {
      const imageBase64 = await stylizeWithPollinations(parsed.data.imageBase64, style.promptTemplate);
      return { imageBase64 };
    } catch (err) {
      request.log.warn(err, "Pollinations unavailable, falling back to local model");
      try {
        const imageBase64 = await stylizeLocally(parsed.data.imageBase64, style.engineKey);
        return { imageBase64 };
      } catch (localErr) {
        request.log.error(localErr, "Local stylization failed");
        return reply.status(503).send({ error: "AI stylization is unavailable right now" });
      }
    }
  });
}
