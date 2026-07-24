import { and, eq } from "drizzle-orm";
import type {
  AiStyle,
  AiStyleAdmin,
  AiStyleTier,
  CreateAiStyleInput,
  UpdateAiStyleInput,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { aiStyles } from "../../db/schema.js";
import { DEFAULT_AI_STYLES } from "./defaultStyles.js";
import { DEFAULT_PREMIUM_AI_STYLES } from "./defaultPremiumStyles.js";

type AiStyleRow = typeof aiStyles.$inferSelect;

/** `/files/...` is already served statically by `@fastify/static` (see `server.ts`) — same convention as design/order images. */
export function previewUrlForKey(key: string): string {
  return `/files/ai-style-previews/${key}.jpg`;
}

function serialize(row: AiStyleRow): AiStyle {
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    previewUrl: previewUrlForKey(row.key),
    tier: row.tier,
  };
}

function serializeAdmin(row: AiStyleRow): AiStyleAdmin {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    promptTemplate: row.promptTemplate,
    engineKey: row.engineKey,
    tier: row.tier,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    previewUrl: previewUrlForKey(row.key),
  };
}

/** Seeds standard styles only once when the table is empty. */
async function ensureStandardSeeded(): Promise<void> {
  const existing = await db.select({ id: aiStyles.id }).from(aiStyles).limit(1);
  if (existing.length > 0) return;
  await db
    .insert(aiStyles)
    .values(DEFAULT_AI_STYLES.map((s) => ({ ...s, tier: "standard" as const })))
    .onConflictDoNothing();
}

/**
 * Inserts missing premium seed styles by key — safe to call on every boot even
 * when the table already has standard styles from an older install.
 */
async function ensurePremiumSeeded(): Promise<void> {
  for (const style of DEFAULT_PREMIUM_AI_STYLES) {
    const [existing] = await db.select({ id: aiStyles.id }).from(aiStyles).where(eq(aiStyles.key, style.key));
    if (existing) continue;
    await db.insert(aiStyles).values({
      key: style.key,
      label: style.label,
      description: style.description,
      promptTemplate: style.promptTemplate,
      engineKey: "",
      tier: "premium",
      sortOrder: style.sortOrder,
      enabled: true,
    });
  }
}

async function ensureSeeded(): Promise<void> {
  await ensureStandardSeeded();
  await ensurePremiumSeeded();
}

/** Active styles for the "Выберите стиль" screen, optionally filtered by tier. */
export async function getEnabledStyles(tier?: AiStyleTier): Promise<AiStyle[]> {
  await ensureSeeded();
  const rows = tier
    ? await db
        .select()
        .from(aiStyles)
        .where(and(eq(aiStyles.enabled, true), eq(aiStyles.tier, tier)))
    : await db.select().from(aiStyles).where(eq(aiStyles.enabled, true));
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serialize);
}

/** Every style (incl. disabled), for the "ИИ-стили" operator panel. */
export async function getAllStylesAdmin(tier?: AiStyleTier): Promise<AiStyleAdmin[]> {
  await ensureSeeded();
  const rows = tier
    ? await db.select().from(aiStyles).where(eq(aiStyles.tier, tier))
    : await db.select().from(aiStyles);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(serializeAdmin);
}

/** Raw rows for local preview render — only standard styles with an engineKey. */
export async function getAllStylesForPreviewRender(): Promise<Pick<AiStyleRow, "key" | "engineKey" | "tier">[]> {
  await ensureSeeded();
  return db.select({ key: aiStyles.key, engineKey: aiStyles.engineKey, tier: aiStyles.tier }).from(aiStyles);
}

/** Looks up the raw row (needed for `promptTemplate`/`engineKey`/`tier`) by `key`. */
export async function getStyleByKey(key: string): Promise<AiStyleRow | null> {
  await ensureSeeded();
  const [row] = await db.select().from(aiStyles).where(eq(aiStyles.key, key));
  return row ?? null;
}

export async function getStyleById(id: number): Promise<AiStyleRow | null> {
  const [row] = await db.select().from(aiStyles).where(eq(aiStyles.id, id));
  return row ?? null;
}

/** `key` is an immutable slug once created. */
export async function createStyle(input: CreateAiStyleInput): Promise<AiStyleAdmin | { error: string }> {
  const existing = await db.select({ id: aiStyles.id }).from(aiStyles).where(eq(aiStyles.key, input.key));
  if (existing.length > 0) {
    return { error: `Style key "${input.key}" already exists` };
  }
  const tier = input.tier ?? "standard";
  if (tier === "standard" && !input.engineKey) {
    return { error: "engineKey is required for standard styles" };
  }
  const [row] = await db
    .insert(aiStyles)
    .values({
      key: input.key,
      label: input.label,
      description: input.description,
      promptTemplate: input.promptTemplate,
      engineKey: tier === "premium" ? "" : (input.engineKey ?? ""),
      tier,
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
