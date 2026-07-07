import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { stylizeRequestSchema, UPLOAD_CREATE_SESSION_EVENT, type UploadCreateSessionAck } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { pointConfig } from "../../db/schema.js";
import { getSyncSocket } from "../sync/client.js";
import { emitAiPhotoReceivedEvent } from "../../realtime/socket.js";
import { getEnabledStyles, getStyleByKey } from "./styles.js";
import { createWifiUploadSession, isWifiUploadSessionUsable, consumeWifiUploadSession } from "./uploadSessions.js";
import { renderUploadPage } from "./uploadPage.js";
import { stylizeWithPollinations } from "./pollinations.js";

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

  app.post("/ai/upload-session", async (request, reply) => {
    const uploadMode = await getUploadMode();

    if (uploadMode === "wifi") {
      const session = createWifiUploadSession();
      return {
        sessionId: session.token,
        // Derived from the request's own `Host` — correct whether the kiosk (and
        // therefore the phone scanning its QR) reaches this point via `localhost`
        // in dev or a LAN IP on a real point (see docs/PLAN.md Этап 9 "Известные ограничения").
        uploadUrl: `${request.protocol}://${request.headers.host}/ai/upload/${session.token}`,
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

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "Missing photo" });
    }

    try {
      const rawBuffer = await file.toBuffer();
      const resized = await sharp(rawBuffer)
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
      return reply.status(500).send({ error: "Failed to process photo" });
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
      request.log.error(err, "Pollinations stylization failed");
      return reply.status(503).send({ error: "AI stylization is unavailable right now" });
    }
  });
}
