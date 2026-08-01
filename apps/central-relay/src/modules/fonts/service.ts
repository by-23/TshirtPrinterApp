import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  BUILTIN_EDITOR_FONTS,
  type AdminFont,
  type FontFormat,
  type ManagedFont,
} from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { managedFonts } from "../../db/schema.js";
import { deleteFontFile, storeFontFile } from "./storage.js";

type FontRow = typeof managedFonts.$inferSelect;

function cssFamilyFromName(familyName: string): string {
  const trimmed = familyName.trim();
  if (trimmed.includes("'") || trimmed.includes(",")) return trimmed;
  return `'${trimmed}', sans-serif`;
}

function serializeAdmin(row: FontRow): AdminFont {
  return {
    id: row.id,
    label: row.label,
    family: row.family,
    kind: row.kind,
    googleFamily: row.googleFamily ?? undefined,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    revision: row.revision,
    fileUrl: row.kind === "custom" && !row.deletedAt ? `/fonts/${row.id}/file` : undefined,
    format: row.format ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletable: row.kind === "custom",
  };
}

function serializeSnapshot(row: FontRow): ManagedFont {
  return {
    id: row.id,
    label: row.label,
    family: row.family,
    kind: row.kind,
    googleFamily: row.googleFamily ?? undefined,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    revision: row.revision,
    fileUrl: row.kind === "custom" ? `/fonts/${row.id}/file` : undefined,
    format: row.format ?? undefined,
  };
}

/** Idempotent seed of built-in editor fonts — safe to call on every boot/seed. */
export async function ensureBuiltinFontsSeeded(): Promise<void> {
  for (const font of BUILTIN_EDITOR_FONTS) {
    await db
      .insert(managedFonts)
      .values({
        id: font.id,
        label: font.label,
        family: font.family,
        kind: font.kind,
        googleFamily: font.googleFamily ?? null,
        enabled: true,
        sortOrder: font.sortOrder,
        revision: 1,
      })
      .onConflictDoNothing();
  }
}

export async function listFontsForAdmin(): Promise<AdminFont[]> {
  await ensureBuiltinFontsSeeded();
  const rows = await db
    .select()
    .from(managedFonts)
    .where(isNull(managedFonts.deletedAt))
    .orderBy(asc(managedFonts.sortOrder), asc(managedFonts.label));
  return rows.map(serializeAdmin);
}

/** Active (non-deleted) fonts for `sync:snapshot`, including disabled ones so points can hide them. */
export async function listFontsForSnapshot(): Promise<ManagedFont[]> {
  await ensureBuiltinFontsSeeded();
  const rows = await db
    .select()
    .from(managedFonts)
    .where(isNull(managedFonts.deletedAt))
    .orderBy(asc(managedFonts.sortOrder), asc(managedFonts.label));
  return rows.map(serializeSnapshot);
}

export async function getFontRow(id: string): Promise<FontRow | null> {
  const [row] = await db.select().from(managedFonts).where(eq(managedFonts.id, id));
  return row ?? null;
}

export async function createCustomFont(input: {
  label: string;
  familyName?: string;
  format: FontFormat;
  tempFilePath: string;
}): Promise<AdminFont> {
  const storagePath = await storeFontFile(input.tempFilePath, input.format);
  const familyName = input.familyName?.trim() || input.label.trim();
  const id = randomUUID();
  const maxSort = await db
    .select({ value: sql<number>`coalesce(max(${managedFonts.sortOrder}), -1)` })
    .from(managedFonts)
    .where(isNull(managedFonts.deletedAt));
  const sortOrder = (maxSort[0]?.value ?? -1) + 1;

  const [row] = await db
    .insert(managedFonts)
    .values({
      id,
      label: input.label.trim(),
      family: cssFamilyFromName(familyName),
      kind: "custom",
      enabled: true,
      sortOrder,
      storagePath,
      format: input.format,
      revision: 1,
    })
    .returning();

  return serializeAdmin(row!);
}

export async function updateFont(
  id: string,
  patch: { label?: string; enabled?: boolean; sortOrder?: number },
): Promise<AdminFont | null> {
  const [row] = await db
    .update(managedFonts)
    .set({
      ...patch,
      revision: sql`${managedFonts.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(managedFonts.id, id), isNull(managedFonts.deletedAt)))
    .returning();
  return row ? serializeAdmin(row) : null;
}

/** Soft-delete custom fonts only. Built-ins must be disabled instead. */
export async function deleteCustomFont(id: string): Promise<boolean> {
  const existing = await getFontRow(id);
  if (!existing || existing.deletedAt || existing.kind !== "custom") return false;

  const [row] = await db
    .update(managedFonts)
    .set({
      deletedAt: new Date(),
      enabled: false,
      revision: sql`${managedFonts.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(managedFonts.id, id))
    .returning();

  if (row?.storagePath) {
    void deleteFontFile(row.storagePath);
  }
  return Boolean(row);
}
