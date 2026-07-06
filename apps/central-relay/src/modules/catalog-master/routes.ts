import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { createDesignSchema, designCategorySchema, updateDesignSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { catalogMaster } from "../../db/schema.js";
import { env } from "../../env.js";

type CatalogRow = typeof catalogMaster.$inferSelect;

const CATALOG_UPLOADS_DIR = path.join(env.UPLOADS_DIR, "catalog");
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function serialize(row: CatalogRow) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
    createdAt: row.createdAt.toISOString(),
  };
}

function uploadedFileUrl(request: FastifyRequest, filename: string): string {
  return `${request.protocol}://${request.headers.host}/uploads/catalog/${filename}`;
}

export async function catalogMasterRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  await mkdir(CATALOG_UPLOADS_DIR, { recursive: true });

  app.get("/catalog/designs", async (request) => {
    const categoryParam = (request.query as Record<string, unknown>).category;
    if (categoryParam !== undefined) {
      const parsedCategory = designCategorySchema.safeParse(categoryParam);
      if (parsedCategory.success) {
        const rows = await db
          .select()
          .from(catalogMaster)
          .where(eq(catalogMaster.category, parsedCategory.data));
        return rows.map(serialize);
      }
    }
    const rows = await db.select().from(catalogMaster);
    return rows.map(serialize);
  });

  app.get<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const [row] = await db.select().from(catalogMaster).where(eq(catalogMaster.id, request.params.id));
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serialize(row);
  });

  app.post("/catalog/designs", async (request, reply) => {
    const parsed = createDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const [row] = await db.insert(catalogMaster).values(parsed.data).returning();
    return reply.status(201).send(serialize(row!));
  });

  app.patch<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const parsed = updateDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }
    const [row] = await db
      .update(catalogMaster)
      .set(parsed.data)
      .where(eq(catalogMaster.id, request.params.id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serialize(row);
  });

  app.delete<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const [row] = await db
      .delete(catalogMaster)
      .where(eq(catalogMaster.id, request.params.id))
      .returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return reply.status(204).send();
  });

  // Uploaded separately from create so the admin panel's `<Upload>` control can
  // send a plain multipart request without re-submitting the other fields.
  app.post<{ Params: { id: string } }>("/catalog/designs/:id/image", async (request, reply) => {
    const [existing] = await db
      .select()
      .from(catalogMaster)
      .where(eq(catalogMaster.id, request.params.id));
    if (!existing) {
      return reply.status(404).send({ error: "Design not found" });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = path.extname(file.filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return reply.status(400).send({ error: "Unsupported file type" });
    }

    const filename = `${randomUUID()}${ext}`;
    const filePath = path.join(CATALOG_UPLOADS_DIR, filename);
    await pipeline(file.file, createWriteStream(filePath));

    const imageUrl = uploadedFileUrl(request, filename);
    const [row] = await db
      .update(catalogMaster)
      .set({ imageUrl })
      .where(eq(catalogMaster.id, request.params.id))
      .returning();
    return serialize(row!);
  });
}
