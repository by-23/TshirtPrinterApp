import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { getUploadSession, isSessionUsable, markSessionUploaded } from "./service.js";
import { renderUploadPage } from "./uploadPage.js";
import { emitPhotoReadyToPoint } from "../../realtime/socket.js";

/** Longest side a phone photo is downscaled to before it's pushed over the socket to point-server as base64. */
const MAX_PHOTO_DIMENSION_PX = 1600;

/**
 * ИИ-раздел (Этап 9), `uploadMode: "relay"` — public (no auth) routes a
 * phone hits after scanning the kiosk's "Загрузка фото" QR. The session
 * `token` itself is the capability (short-lived, one-shot) — see
 * `./service.ts`.
 */
export async function uploadRelayRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>("/upload/:token", async (request, reply) => {
    const session = await getUploadSession(request.params.token);
    if (!session || !isSessionUsable(session)) {
      return reply.status(410).type("text/html").send("<p>Ссылка недействительна или истекла.</p>");
    }
    return reply.type("text/html").send(renderUploadPage(request.params.token));
  });

  app.post<{ Params: { token: string } }>("/upload/:token/photo", async (request, reply) => {
    const session = await getUploadSession(request.params.token);
    if (!session || !isSessionUsable(session)) {
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

      await markSessionUploaded(session.id);
      emitPhotoReadyToPoint(session.pointId, { token: session.id, imageBase64 });

      return reply.send({ ok: true });
    } catch (err) {
      app.log.error(err, "Failed to process uploaded photo");
      return reply.status(500).send({ error: "Failed to process photo" });
    }
  });
}
