import { asc, eq, max } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import {
  reorderAdsVideosInputSchema,
  updateAdsVideoInputSchema,
  type AdsVideo,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { adsVideos } from "../../db/schema.js";
import {
  deleteAdsVideoFile,
  isAllowedAdsVideo,
  publicAdsVideoUrl,
  saveAdsVideoFile,
  titleFromFilename,
} from "./storage.js";

type AdsVideoRow = typeof adsVideos.$inferSelect;

function serialize(row: AdsVideoRow): AdsVideo {
  return {
    id: row.id,
    title: row.title,
    fileUrl: publicAdsVideoUrl(row.filename),
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    createdAt: row.createdAt,
  };
}

export const adsRoutes: FastifyPluginAsync = async (app) => {
  /** Kiosk playlist — only enabled videos, sorted for the attract loop. */
  app.get("/ads/videos", async () => {
    const rows = await db
      .select()
      .from(adsVideos)
      .where(eq(adsVideos.enabled, true))
      .orderBy(asc(adsVideos.sortOrder), asc(adsVideos.id));
    return rows.map(serialize);
  });

  /** Operator panel — every video including disabled. */
  app.get("/ads/videos/admin", async () => {
    const rows = await db
      .select()
      .from(adsVideos)
      .orderBy(asc(adsVideos.sortOrder), asc(adsVideos.id));
    return rows.map(serialize);
  });

  app.post("/ads/videos", async (request, reply) => {
    try {
      const file = await request.file();
      if (!file) {
        return reply.status(400).send({ error: "Missing video file" });
      }
      if (!isAllowedAdsVideo(file.mimetype, file.filename)) {
        return reply.status(400).send({ error: "Only mp4 / webm / ogg videos are allowed" });
      }

      const filename = await saveAdsVideoFile(file.file, file.filename, file.mimetype);
      const title = titleFromFilename(file.filename);

      const [agg] = await db.select({ maxOrder: max(adsVideos.sortOrder) }).from(adsVideos);
      const sortOrder = (agg?.maxOrder ?? -1) + 1;

      const [row] = await db
        .insert(adsVideos)
        .values({
          title,
          filename,
          mimeType: file.mimetype || "video/mp4",
          sortOrder,
          enabled: true,
        })
        .returning();

      if (!row) {
        await deleteAdsVideoFile(filename);
        return reply.status(500).send({ error: "Failed to save video" });
      }
      return serialize(row);
    } catch (err) {
      request.log.error(err, "Failed to upload ads video");
      return reply.status(500).send({ error: "Failed to upload video" });
    }
  });

  app.patch<{ Params: { id: string } }>("/ads/videos/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const parsed = updateAdsVideoInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [existing] = await db.select().from(adsVideos).where(eq(adsVideos.id, id));
    if (!existing) {
      return reply.status(404).send({ error: "Video not found" });
    }

    const patch = parsed.data;
    const [row] = await db
      .update(adsVideos)
      .set({
        title: patch.title ?? existing.title,
        sortOrder: patch.sortOrder ?? existing.sortOrder,
        enabled: patch.enabled ?? existing.enabled,
      })
      .where(eq(adsVideos.id, id))
      .returning();

    return row ? serialize(row) : reply.status(404).send({ error: "Video not found" });
  });

  app.put("/ads/videos/reorder", async (request, reply) => {
    const parsed = reorderAdsVideosInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { ids } = parsed.data;
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      if (id === undefined) continue;
      await db.update(adsVideos).set({ sortOrder: i }).where(eq(adsVideos.id, id));
    }

    const rows = await db
      .select()
      .from(adsVideos)
      .orderBy(asc(adsVideos.sortOrder), asc(adsVideos.id));
    return rows.map(serialize);
  });

  app.delete<{ Params: { id: string } }>("/ads/videos/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id)) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [existing] = await db.select().from(adsVideos).where(eq(adsVideos.id, id));
    if (!existing) {
      return reply.status(404).send({ error: "Video not found" });
    }

    await db.delete(adsVideos).where(eq(adsVideos.id, id));
    await deleteAdsVideoFile(existing.filename);
    return { ok: true };
  });
};
