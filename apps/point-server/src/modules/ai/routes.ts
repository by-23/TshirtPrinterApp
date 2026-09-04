import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  stylizeRequestSchema,
  createAiStyleInputSchema,
  updateAiStyleInputSchema,
  updateAiConfigInputSchema,
  testAiApiKeyInputSchema,
  aiStyleTierSchema,
  aiProviderSchema,
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
import { getAiConfig, getAiConfigRow, updateAiConfig, resolveOpenAIApiKey, resolveGeminiApiKey } from "./config.js";
import { testOpenAIApiKey } from "./testOpenAIApiKey.js";
import { testGeminiApiKey } from "./testGeminiApiKey.js";
import { createWifiUploadSession, isWifiUploadSessionUsable, consumeWifiUploadSession } from "./uploadSessions.js";
import { renderUploadPage } from "./uploadPage.js";
import { normalizePhonePhoto } from "./normalizePhoto.js";
import { stylizeWithPollinations } from "./pollinations.js";
import { stylizeWithOpenAI, isOpenAIConfigured } from "./openai.js";
import { stylizeWithGemini, isGeminiConfigured } from "./gemini.js";
import { stylizeLocally } from "./local/index.js";
import {
  regeneratePreview,
  savePreviewFromBuffer,
  savePreviewFromDataUrl,
  loadSamplePortrait,
} from "./local/previewCache.js";

const POINT_CONFIG_ROW_ID = 1;
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
 * ИИ-раздел (Этап 9) — photo source, style catalogs (standard + premium),
 * Pollinations / OpenAI / Gemini stylization.
 */
export async function aiRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { tier?: string } }>("/ai/styles", async (request, reply) => {
    const tierParsed = request.query.tier ? aiStyleTierSchema.safeParse(request.query.tier) : null;
    if (request.query.tier && !tierParsed?.success) {
      return reply.status(400).send({ error: "Invalid tier — use standard or premium" });
    }
    return getEnabledStyles(tierParsed?.success ? tierParsed.data : undefined);
  });

  app.get("/ai/providers", async () => {
    return {
      chatgpt: await isOpenAIConfigured(),
      gemini: await isGeminiConfigured(),
    };
  });

  app.get("/ai/config", async () => {
    return getAiConfig();
  });

  app.patch("/ai/config", async (request, reply) => {
    const parsed = updateAiConfigInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }
    return updateAiConfig(parsed.data);
  });

  app.post("/ai/config/test-openai", async (request, reply) => {
    const parsed = testAiApiKeyInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const draft = parsed.data.apiKey?.trim();
    const row = await getAiConfigRow();
    const apiKey = draft || resolveOpenAIApiKey(row) || "";
    return testOpenAIApiKey(apiKey);
  });

  app.post("/ai/config/test-gemini", async (request, reply) => {
    const parsed = testAiApiKeyInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const draft = parsed.data.apiKey?.trim();
    const row = await getAiConfigRow();
    const apiKey = draft || resolveGeminiApiKey(row) || "";
    return testGeminiApiKey(apiKey);
  });

  // --- "ИИ-стили" operator panel (admin CRUD over the ai_styles catalog) ---

  app.get<{ Querystring: { tier?: string } }>("/ai/styles/admin", async (request, reply) => {
    const tierParsed = request.query.tier ? aiStyleTierSchema.safeParse(request.query.tier) : null;
    if (request.query.tier && !tierParsed?.success) {
      return reply.status(400).send({ error: "Invalid tier — use standard or premium" });
    }
    return getAllStylesAdmin(tierParsed?.success ? tierParsed.data : undefined);
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

  app.post<{ Params: { id: string }; Querystring: { provider?: string } }>(
    "/ai/styles/:id/regenerate-preview",
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id)) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const style = await getStyleById(id);
      if (!style) {
        return reply.status(404).send({ error: "Style not found" });
      }
      try {
        if (style.tier === "premium") {
          const providerParsed = aiProviderSchema.safeParse(request.query.provider ?? "chatgpt");
          if (!providerParsed.success || providerParsed.data === "standard") {
            return reply.status(400).send({ error: "Premium preview requires provider=chatgpt or gemini" });
          }
          const sample = await loadSamplePortrait();
          const styled =
            providerParsed.data === "chatgpt"
              ? await stylizeWithOpenAI(sample, style.promptTemplate)
              : await stylizeWithGemini(sample, style.promptTemplate);
          await savePreviewFromDataUrl(style.key, styled);
        } else {
          await regeneratePreview(style.key, style.engineKey);
        }
        return { ok: true };
      } catch (err) {
        request.log.error(err, "Failed to regenerate AI style preview");
        return reply.status(500).send({ error: "Failed to regenerate preview" });
      }
    },
  );

  app.post<{ Params: { id: string } }>("/ai/styles/:id/preview", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const style = await getStyleById(id);
    if (!style) {
      return reply.status(404).send({ error: "Style not found" });
    }
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "Missing preview image" });
      }
      const rawBuffer = await file.toBuffer();
      await savePreviewFromBuffer(style.key, rawBuffer);
      return { ok: true, previewUrl: `/files/ai-style-previews/${style.key}.jpg` };
    } catch (err) {
      request.log.error(err, "Failed to upload AI style preview");
      return reply.status(500).send({ error: "Failed to upload preview" });
    }
  });

  app.post("/ai/upload-session", async (request, reply) => {
    const uploadMode = await getUploadMode();

    if (uploadMode === "wifi") {
      const session = createWifiUploadSession();
      return {
        sessionId: session.token,
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

      const resized = await normalizePhonePhoto(rawBuffer, file.filename, file.mimetype);
      const imageBase64 = `data:image/jpeg;base64,${resized.toString("base64")}`;

      consumeWifiUploadSession(request.params.sessionId);
      emitAiPhotoReceivedEvent({ sessionId: request.params.sessionId, imageBase64 });

      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, "Failed to process uploaded photo");
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: "Failed to process photo", message });
    }
  });

  app.post("/ai/stylize", async (request, reply) => {
    const parsed = stylizeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const provider = parsed.data.provider ?? "standard";
    const style = await getStyleByKey(parsed.data.styleKey);
    if (!style || !style.enabled) {
      return reply.status(400).send({ error: "Unknown or disabled style" });
    }

    const expectedTier = provider === "standard" ? "standard" : "premium";
    if (style.tier !== expectedTier) {
      return reply.status(400).send({
        error:
          provider === "standard"
            ? "This style requires ChatGPT or Gemini"
            : "Premium providers require a premium style",
      });
    }

    if (provider === "chatgpt") {
      try {
        const imageBase64 = await stylizeWithOpenAI(parsed.data.imageBase64, style.promptTemplate);
        return { imageBase64 };
      } catch (err) {
        request.log.error(err, "OpenAI stylization failed");
        return reply.status(503).send({ error: "ChatGPT stylization is unavailable right now" });
      }
    }

    if (provider === "gemini") {
      try {
        const imageBase64 = await stylizeWithGemini(parsed.data.imageBase64, style.promptTemplate);
        return { imageBase64 };
      } catch (err) {
        request.log.error(err, "Gemini stylization failed");
        return reply.status(503).send({ error: "Gemini stylization is unavailable right now" });
      }
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
