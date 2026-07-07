import { randomUUID } from "node:crypto";

/**
 * ИИ-раздел (Этап 9), `uploadMode: "wifi"` — one-shot QR photo-upload
 * sessions kept purely in memory (no DB table, unlike central-relay's
 * `upload_sessions`): short TTL, process-local, and a point restart simply
 * expiring an in-flight QR is an acceptable fail-open outcome (the kiosk
 * screen would just show a stale QR until the user backs out). Mirrors the
 * relay-mode session shape (`token`/`expiresAt`) from
 * `@tshirt/shared-types`'s `createAiUploadSessionResponseSchema`.
 */
const SESSION_TTL_MS = 15 * 60 * 1000;

interface WifiUploadSession {
  expiresAt: number;
}

const sessions = new Map<string, WifiUploadSession>();

export function createWifiUploadSession(): { token: string; expiresAt: string } {
  const token = randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { expiresAt });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function isWifiUploadSessionUsable(token: string): boolean {
  const session = sessions.get(token);
  return Boolean(session && session.expiresAt > Date.now());
}

/** Consumes the session so a QR can't be replayed for a second photo. */
export function consumeWifiUploadSession(token: string): void {
  sessions.delete(token);
}
