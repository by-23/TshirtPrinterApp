import { asc, eq, notInArray } from "drizzle-orm";
import type { FastifyBaseLogger } from "fastify";
import { BUILTIN_EDITOR_FONTS, type ManagedFont } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { managedFonts } from "../../db/schema.js";
import { env } from "../../env.js";
import { emitFontsEvent } from "../../realtime/socket.js";
import { deleteFontFile, publicFontUrl, writeFontFile } from "./storage.js";

type FontRow = typeof managedFonts.$inferSelect;

function serialize(row: FontRow): ManagedFont {
  return {
    id: row.id,
    label: row.label,
    family: row.family,
    kind: row.kind,
    googleFamily: row.googleFamily ?? undefined,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    revision: row.revision,
    fileUrl: row.localFileUrl ?? undefined,
    format: row.format ?? undefined,
  };
}

/** Seeds built-in editor fonts when the local table is empty (offline / pre-sync). */
export async function ensureLocalBuiltinFonts(): Promise<void> {
  const existing = await db.select({ id: managedFonts.id }).from(managedFonts).limit(1);
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  await db.insert(managedFonts).values(
    BUILTIN_EDITOR_FONTS.map((font) => ({
      id: font.id,
      label: font.label,
      family: font.family,
      kind: font.kind,
      googleFamily: font.googleFamily ?? null,
      enabled: true,
      sortOrder: font.sortOrder,
      revision: 1,
      updatedAt: now,
    })),
  );
}

export async function listEnabledFonts(): Promise<ManagedFont[]> {
  await ensureLocalBuiltinFonts();
  const rows = await db
    .select()
    .from(managedFonts)
    .where(eq(managedFonts.enabled, true))
    .orderBy(asc(managedFonts.sortOrder), asc(managedFonts.label));
  return rows.map(serialize);
}

async function downloadCentralFontFile(fileUrl: string): Promise<Buffer> {
  const { CENTRAL_RELAY_URL, POINT_SYNC_ID, POINT_SYNC_TOKEN } = env;
  if (!CENTRAL_RELAY_URL || !POINT_SYNC_ID || !POINT_SYNC_TOKEN) {
    throw new Error("Central-relay sync is not configured");
  }
  const res = await fetch(`${CENTRAL_RELAY_URL}${fileUrl}`, {
    headers: { "x-point-id": POINT_SYNC_ID, "x-point-token": POINT_SYNC_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`Failed to download font file: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Applies `sync:snapshot.fonts`: upserts every font, downloads custom files
 * when revision/format changes, and removes fonts no longer present centrally.
 */
export async function applyFontsFromSnapshot(
  fonts: ManagedFont[],
  log: FastifyBaseLogger,
): Promise<void> {
  const now = new Date().toISOString();
  const keepIds = fonts.map((font) => font.id);

  for (const font of fonts) {
    const [existing] = await db.select().from(managedFonts).where(eq(managedFonts.id, font.id));
    let localFileUrl = existing?.localFileUrl ?? null;
    let format = font.format ?? existing?.format ?? null;

    if (font.kind === "custom" && font.fileUrl && font.format) {
      const expectedUrl = publicFontUrl(font.id, font.format);
      const needsDownload =
        !existing ||
        existing.revision < font.revision ||
        existing.localFileUrl !== expectedUrl ||
        existing.format !== font.format;
      if (needsDownload) {
        try {
          const data = await downloadCentralFontFile(font.fileUrl);
          if (existing?.localFileUrl && existing.localFileUrl !== expectedUrl) {
            await deleteFontFile(existing.localFileUrl);
          }
          localFileUrl = await writeFontFile(font.id, font.format, data);
          format = font.format;
        } catch (err) {
          log.warn({ err, fontId: font.id }, "Failed to download custom font — keeping previous file if any");
          if (!localFileUrl) {
            continue;
          }
        }
      }
    }

    const values = {
      id: font.id,
      label: font.label,
      family: font.family,
      kind: font.kind,
      googleFamily: font.googleFamily ?? null,
      enabled: font.enabled,
      sortOrder: font.sortOrder,
      revision: font.revision,
      localFileUrl,
      format,
      updatedAt: now,
    };

    if (existing) {
      await db.update(managedFonts).set(values).where(eq(managedFonts.id, font.id));
    } else {
      await db.insert(managedFonts).values(values);
    }
  }

  if (keepIds.length > 0) {
    const stale = await db.select().from(managedFonts).where(notInArray(managedFonts.id, keepIds));
    for (const row of stale) {
      await deleteFontFile(row.localFileUrl);
      await db.delete(managedFonts).where(eq(managedFonts.id, row.id));
    }
  } else {
    const all = await db.select().from(managedFonts);
    for (const row of all) {
      await deleteFontFile(row.localFileUrl);
    }
    await db.delete(managedFonts);
  }

  emitFontsEvent(await listEnabledFonts());
}
