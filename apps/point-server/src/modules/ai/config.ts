import { eq } from "drizzle-orm";
import type { AiConfig, UpdateAiConfigInput } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { aiConfig } from "../../db/schema.js";
import { env } from "../../env.js";

const CONFIG_ID = 1;

type ConfigRow = typeof aiConfig.$inferSelect;

/** Panel-stored key wins over `.env` — both optional (fail-open when unset). */
export function resolveOpenAIApiKey(row?: { openaiApiKey?: string | null } | null): string | undefined {
  const fromDb = row?.openaiApiKey?.trim();
  if (fromDb) return fromDb;
  const fromEnv = env.OPENAI_API_KEY?.trim();
  return fromEnv || undefined;
}

export function resolveGeminiApiKey(row?: { geminiApiKey?: string | null } | null): string | undefined {
  const fromDb = row?.geminiApiKey?.trim();
  if (fromDb) return fromDb;
  const fromEnv = env.GEMINI_API_KEY?.trim();
  return fromEnv || undefined;
}

function serialize(row: ConfigRow): AiConfig {
  return {
    openaiApiKey: row.openaiApiKey ?? null,
    geminiApiKey: row.geminiApiKey ?? null,
    openaiKeyConfigured: Boolean(resolveOpenAIApiKey(row)),
    geminiKeyConfigured: Boolean(resolveGeminiApiKey(row)),
    updatedAt: row.updatedAt,
  };
}

async function ensureRow(): Promise<ConfigRow> {
  const [existing] = await db.select().from(aiConfig).where(eq(aiConfig.id, CONFIG_ID));
  if (existing) return existing;
  await db.insert(aiConfig).values({ id: CONFIG_ID }).onConflictDoNothing();
  const [row] = await db.select().from(aiConfig).where(eq(aiConfig.id, CONFIG_ID));
  return row!;
}

export async function getAiConfig(): Promise<AiConfig> {
  return serialize(await ensureRow());
}

export async function getAiConfigRow(): Promise<ConfigRow> {
  return ensureRow();
}

export async function updateAiConfig(input: UpdateAiConfigInput): Promise<AiConfig> {
  await ensureRow();
  const patch: Partial<ConfigRow> & { updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };
  if ("openaiApiKey" in input) {
    patch.openaiApiKey = input.openaiApiKey?.trim() || null;
  }
  if ("geminiApiKey" in input) {
    patch.geminiApiKey = input.geminiApiKey?.trim() || null;
  }
  const [updated] = await db.update(aiConfig).set(patch).where(eq(aiConfig.id, CONFIG_ID)).returning();
  return serialize(updated!);
}
