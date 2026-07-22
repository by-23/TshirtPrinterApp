import { createReadStream } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  createCatalogManualDesignSchema,
  galleryCategorySchema,
  updateCatalogManualDesignSchema,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { points } from "../../db/schema.js";
import {
  DuplicateManualDesignError,
  createManualDesign,
  deleteManualDesign,
  getManualDesign,
  getManualDesignRow,
  listManualDesigns,
  updateManualDesign,
} from "./service.js";
import { deleteTempUploadFile, writeTempUploadFile } from "./storage.js";
import { pushManualSyncToAllPoints } from "../../realtime/socket.js";

/** True if the buffer is a real PNG (checked via `sharp`, not just the client-supplied mimetype/extension). */
async function isPngBuffer(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return metadata.format === "png";
  } catch {
    return false;
  }
}

/** A point's own outbound socket auth (`x-point-id`/`x-point-token` headers) — mirrors the Socket.IO handshake check in `realtime/socket.ts`. */
async function isAuthorizedPoint(request: FastifyRequest): Promise<boolean> {
  const pointId = request.headers["x-point-id"];
  const token = request.headers["x-point-token"];
  if (typeof pointId !== "string" || typeof token !== "string") return false;
  const [point] = await db.select({ syncToken: points.syncToken }).from(points).where(eq(points.id, pointId));
  return Boolean(point && point.syncToken === token);
}

/**
 * Admin panel's "Каталог" tab (manual PNG uploads, fanned out to every
 * point) — see `packages/shared-types/src/design.ts` for the sync
 * contracts and `docs/PLAN.md` for the grill-me discussion behind this
 * design (fan-out to all points, read-only on the point side, admin wins
 * sort ties over scraped designs).
 *
 * Every route except `GET /catalog-manual/:id/file` requires an admin JWT
 * (`app.authenticate`, same as `points`/`pricing`) — that one route also
 * accepts a point's own sync credentials, since points (not admins) are the
 * ones downloading the actual image bytes.
 */
export async function catalogManualRoutes(app: FastifyInstance) {
  app.get("/catalog-manual", { preHandler: app.authenticate }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    if (query.category !== undefined) {
      const parsedCategory = galleryCategorySchema.safeParse(query.category);
      if (!parsedCategory.success) {
        return reply.status(400).send({ error: "Invalid category" });
      }
      return listManualDesigns(parsedCategory.data);
    }
    return listManualDesigns();
  });

  app.get<{ Params: { id: string } }>(
    "/catalog-manual/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const design = await getManualDesign(request.params.id);
      if (!design) {
        return reply.status(404).send({ error: "Design not found" });
      }
      return design;
    },
  );

  app.post("/catalog-manual", { preHandler: app.authenticate }, async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const parsedCategory = galleryCategorySchema.safeParse(query.category);
    if (!parsedCategory.success) {
      return reply.status(400).send({ error: "Missing or invalid category query param" });
    }

    let file;
    try {
      file = await request.file();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: "Invalid upload", message });
    }
    if (!file) {
      return reply.status(400).send({ error: "Missing file" });
    }

    const buffer = await file.toBuffer();
    if (!(await isPngBuffer(buffer))) {
      return reply.status(400).send({ error: "Only PNG images are accepted" });
    }

    const parsedInput = createCatalogManualDesignSchema.safeParse({
      category: parsedCategory.data,
      title: file.filename?.replace(/\.[^./]+$/, "") || "design",
    });
    if (!parsedInput.success) {
      return reply.status(400).send({ error: parsedInput.error.flatten() });
    }

    const tempFilePath = await writeTempUploadFile(buffer);
    try {
      const row = await createManualDesign({
        category: parsedInput.data.category,
        title: parsedInput.data.title,
        tempFilePath,
      });
      void pushManualSyncToAllPoints();
      const design = await getManualDesign(row.id);
      return reply.status(201).send(design);
    } catch (err) {
      await deleteTempUploadFile(tempFilePath);
      if (err instanceof DuplicateManualDesignError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>(
    "/catalog-manual/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const parsed = updateCatalogManualDesignSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const row = await updateManualDesign(request.params.id, parsed.data);
      if (!row) {
        return reply.status(404).send({ error: "Design not found" });
      }
      void pushManualSyncToAllPoints();
      return getManualDesign(row.id);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/catalog-manual/:id",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const row = await deleteManualDesign(request.params.id);
      if (!row) {
        return reply.status(404).send({ error: "Design not found" });
      }
      void pushManualSyncToAllPoints();
      return reply.status(204).send();
    },
  );

  // No `app.authenticate` preHandler here — see the module doc comment above.
  app.get<{ Params: { id: string } }>("/catalog-manual/:id/file", async (request, reply) => {
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

    const row = await getManualDesignRow(request.params.id);
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    reply.type("image/png");
    return reply.send(createReadStream(row.storagePath));
  });
}
