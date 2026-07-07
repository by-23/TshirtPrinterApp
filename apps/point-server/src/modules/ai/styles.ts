import { eq } from "drizzle-orm";
import type { AiStyle, AiStyleAdmin, CreateAiStyleInput, UpdateAiStyleInput } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { aiStyles } from "../../db/schema.js";
import { DEFAULT_AI_STYLES } from "./defaultStyles.js";

type AiStyleRow = typeof aiStyles.$inferSelect;

/** `/files/...` is already served statically by `@fastify/static` (see `server.ts`) — same convention as design/order images. */
export function previewUrlForKey(key: string): string {
  return `/files/ai-style-previews/${key}.jpg`;
}

function serialize(row: AiStyleRow): AiStyle {
  return { key: row.key, label: row.label, description: row.description, previewUrl: previewUrlForKey(row.key) };
}

function serializeAdmin(row: AiStyleRow): AiStyleAdmin {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    promptTemplate: row.promptTemplate,
    engineKey: row.engineKey,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    previewUrl: previewUrlForKey(row.key),
  };
}

/** Seeds `DEFAULT_AI_STYLES` only once, when the table is empty — see the comment on `db/schema.ts`'s `aiStyles`. */
async function ensureSeeded(): Promise<void> {
  const existing = await db.select({ id: aiStyles.id }).from(aiStyles).limit(1);
  if (existing.length > 0) return;
  await db.insert(aiStyles).values(DEFAULT_AI_STYLES).onConflictDoNothing();
}

/** Active styles for the "Выберите стиль" screen, in display order. */
export async function getEnabledStyles(): Promise<AiStyle[]> {
  await ensureSeeded();
  const rows = await db.select().from(aiStyles).where(eq(aiStyles.enabled, true));
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serialize);
}

/** Every style (incl. disabled), for the "ИИ-стили" operator panel. */
export async function getAllStylesAdmin(): Promise<AiStyleAdmin[]> {
  await ensureSeeded();
  const rows = await db.select().from(aiStyles);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serializeAdmin);
}

/** Raw rows (key + engineKey), used to pre-render every style's preview thumbnail on boot — see `local/previewCache.ts`. */
export async function getAllStylesForPreviewRender(): Promise<Pick<AiStyleRow, "key" | "engineKey">[]> {
  await ensureSeeded();
  return db.select({ key: aiStyles.key, engineKey: aiStyles.engineKey }).from(aiStyles);
}

/** Looks up the raw row (needed for `promptTemplate`/`engineKey`) by `key` — used by `POST /ai/stylize`. */
export async function getStyleByKey(key: string): Promise<AiStyleRow | null> {
  await ensureSeeded();
  const [row] = await db.select().from(aiStyles).where(eq(aiStyles.key, key));
  return row ?? null;
}

export async function getStyleById(id: number): Promise<AiStyleRow | null> {
  const [row] = await db.select().from(aiStyles).where(eq(aiStyles.id, id));
  return row ?? null;
}

/** `key` is an immutable slug once created — mirrors `GalleryCategory`/other stable identifiers elsewhere in the project. */
export async function createStyle(input: CreateAiStyleInput): Promise<AiStyleAdmin | { error: string }> {
  const existing = await db.select({ id: aiStyles.id }).from(aiStyles).where(eq(aiStyles.key, input.key));
  if (existing.length > 0) {
    return { error: `Style key "${input.key}" already exists` };
  }
  const [row] = await db
    .insert(aiStyles)
    .values({
      key: input.key,
      label: input.label,
      description: input.description,
      promptTemplate: input.promptTemplate,
      engineKey: input.engineKey,
      sortOrder: input.sortOrder ?? 0,
      enabled: input.enabled ?? true,
    })
    .returning();
  return serializeAdmin(row!);
}

export async function updateStyleById(id: number, patch: UpdateAiStyleInput): Promise<AiStyleAdmin | null> {
  const [row] = await db.update(aiStyles).set(patch).where(eq(aiStyles.id, id)).returning();
  return row ? serializeAdmin(row) : null;
}

export async function deleteStyleById(id: number): Promise<boolean> {
  const deleted = await db.delete(aiStyles).where(eq(aiStyles.id, id)).returning({ id: aiStyles.id });
  return deleted.length > 0;
}
