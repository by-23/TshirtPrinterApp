import type { FastifyInstance } from "fastify";
import { getUploadSession, isSessionUsable, markSessionUploaded } from "./service.js";
import { renderUploadPage } from "./uploadPage.js";
import { emitPhotoReadyToPoint } from "../../realtime/socket.js";
import { normalizePhonePhoto } from "./normalizePhoto.js";

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
      app.log.info(
        { filename: file.filename, mimetype: file.mimetype, bytes: rawBuffer.length },
        "Received phone photo upload",
      );

      const resized = await normalizePhonePhoto(rawBuffer, file.filename, file.mimetype);
      const imageBase64 = `data:image/jpeg;base64,${resized.toString("base64")}`;

      await markSessionUploaded(session.id);
      emitPhotoReadyToPoint(session.pointId, { token: session.id, imageBase64 });

      return reply.send({ ok: true });
    } catch (err) {
      app.log.error(err, "Failed to process uploaded photo");
      // Surfaced verbatim on the phone's upload page (see `uploadPage.ts`)
      // so failures can be diagnosed from the field without server log access.
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: "Failed to process photo", message });
    }
  });
}
