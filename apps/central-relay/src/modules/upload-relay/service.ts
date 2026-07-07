import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { uploadSessions } from "../../db/schema.js";
import { env } from "../../env.js";

/** Matches the 15-minute countdown shown on the kiosk's "Загрузка фото" screen. */
const SESSION_TTL_MS = 15 * 60 * 1000;

export interface UploadSessionInfo {
  token: string;
  uploadUrl: string;
  expiresAt: string;
}

/** Mints a fresh one-shot QR photo-upload session for a point (Этап 9, `uploadMode: "relay"`). */
export async function createUploadSession(pointId: string): Promise<UploadSessionInfo> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(uploadSessions)
    .values({ pointId, expiresAt })
    .returning();
  const session = row!;
  return {
    token: session.id,
    uploadUrl: `${env.PUBLIC_BASE_URL}/upload/${session.id}`,
    expiresAt: session.expiresAt.toISOString(),
  };
}

export type UploadSessionRow = typeof uploadSessions.$inferSelect;

export async function getUploadSession(token: string): Promise<UploadSessionRow | null> {
  const [row] = await db.select().from(uploadSessions).where(eq(uploadSessions.id, token));
  return row ?? null;
}

/** True if the session exists, hasn't been used yet, and hasn't expired. */
export function isSessionUsable(session: UploadSessionRow): boolean {
  return session.status === "pending" && session.expiresAt.getTime() > Date.now();
}

export async function markSessionUploaded(token: string): Promise<void> {
  await db.update(uploadSessions).set({ status: "uploaded" }).where(eq(uploadSessions.id, token));
}
