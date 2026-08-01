import { createReadStream } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { createCustomFontSchema, updateManagedFontSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { points } from "../../db/schema.js";
import { pushSnapshotToAllPoints } from "../../realtime/socket.js";
import {
  createCustomFont,
  deleteCustomFont,
  getFontRow,
  listFontsForAdmin,
  updateFont,
} from "./service.js";
import {
  contentTypeForFormat,
  deleteTempFontUpload,
  detectFontFormat,
  writeTempFontUpload,
} from "./storage.js";

async function isAuthorizedPoint(request: FastifyRequest): Promise<boolean> {
  const pointId = request.headers["x-point-id"];
  const token = request.headers["x-point-token"];
  if (typeof pointId !== "string" || typeof token !== "string") return false;
  const [point] = await db.select({ syncToken: points.syncToken }).from(points).where(eq(points.id, pointId));
  return Boolean(point && point.syncToken === token);
}

/**
 * Admin «Шрифты» tab — built-in editor fonts (enable/disable) + custom
 * uploads fanned out to points via `sync:snapshot.fonts`. File bytes for
 * custom fonts are fetched by points from `GET /fonts/:id/file`.
 */
export async function fontsRoutes(app: FastifyInstance) {
  app.get("/fonts", { preHandler: app.authenticate }, async () => listFontsForAdmin());

  app.post("/fonts", { preHandler: app.authenticate }, async (request, reply) => {
    let fileBuffer: Buffer | null = null;
    let filename = "font";
    let mimeType: string | undefined;
    let labelField: string | undefined;
    let familyField: string | undefined;

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          filename = part.filename || filename;
          mimeType = part.mimetype;
          fileBuffer = await part.toBuffer();
        } else if (part.fieldname === "label" && typeof part.value === "string") {
          labelField = part.value;
        } else if (part.fieldname === "familyName" && typeof part.value === "string") {
          familyField = part.value;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: "Invalid upload", message });
    }

    if (!fileBuffer) {
      return reply.status(400).send({ error: "Missing file" });
    }

    const format = detectFontFormat(filename, mimeType);
    if (!format) {
      return reply.status(400).send({ error: "Only TTF, OTF, WOFF, or WOFF2 fonts are accepted" });
    }

    const parsedInput = createCustomFontSchema.safeParse({
      label: labelField?.trim() || filename.replace(/\.[^./]+$/, "") || "Font",
      familyName: familyField?.trim() || undefined,
    });
    if (!parsedInput.success) {
      return reply.status(400).send({ error: parsedInput.error.flatten() });
    }

    const tempFilePath = await writeTempFontUpload(fileBuffer, format);
    try {
      const font = await createCustomFont({
        label: parsedInput.data.label,
        familyName: parsedInput.data.familyName,
        format,
        tempFilePath,
      });
      void pushSnapshotToAllPoints();
      return reply.status(201).send(font);
    } catch (err) {
      await deleteTempFontUpload(tempFilePath);
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/fonts/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const parsed = updateManagedFontSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const font = await updateFont(request.params.id, parsed.data);
      if (!font) {
        return reply.status(404).send({ error: "Font not found" });
      }
      void pushSnapshotToAllPoints();
      return font;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/fonts/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const ok = await deleteCustomFont(request.params.id);
      if (!ok) {
        return reply.status(404).send({ error: "Custom font not found" });
      }
      void pushSnapshotToAllPoints();
      return reply.status(204).send();
    },
  );

  app.get<{ Params: { id: string } }>("/fonts/:id/file", async (request, reply) => {
    let authorized = false;
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        await request.jwtVerify();
        authorized = true;
      } catch {
        authorized = false;
      }
    }
    if (!authorized) {
      authorized = await isAuthorizedPoint(request);
    }
    if (!authorized) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const row = await getFontRow(request.params.id);
    if (!row || row.deletedAt || row.kind !== "custom" || !row.storagePath || !row.format) {
      return reply.status(404).send({ error: "Font file not found" });
    }
    reply.type(contentTypeForFormat(row.format));
    return reply.send(createReadStream(row.storagePath));
  });
}
