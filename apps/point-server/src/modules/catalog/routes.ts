import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createDesignSchema, designCategorySchema, updateDesignSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { designs } from "../../db/schema.js";

type DesignRow = typeof designs.$inferSelect;

function serializeDesign(row: DesignRow) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    imageUrl: row.imageUrl,
    isFeatured: row.isFeatured,
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/catalog/designs", async (request, reply) => {
    const categoryParam = (request.query as Record<string, unknown>).category;

    if (categoryParam !== undefined) {
      const parsedCategory = designCategorySchema.safeParse(categoryParam);
      if (!parsedCategory.success) {
        return reply.status(400).send({ error: "Invalid category" });
      }
      const rows = await db.select().from(designs).where(eq(designs.category, parsedCategory.data));
      return rows.map(serializeDesign);
    }

    const rows = await db.select().from(designs);
    return rows.map(serializeDesign);
  });

  app.get<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.select().from(designs).where(eq(designs.id, id));
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  app.post("/catalog/designs", async (request, reply) => {
    const parsed = createDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db.insert(designs).values(parsed.data).returning();
    return reply.status(201).send(serializeDesign(row!));
  });

  app.patch<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const parsed = updateDesignSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const [row] = await db.update(designs).set(parsed.data).where(eq(designs.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return serializeDesign(row);
  });

  app.delete<{ Params: { id: string } }>("/catalog/designs/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.delete(designs).where(eq(designs.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Design not found" });
    }
    return reply.status(204).send();
  });
}
