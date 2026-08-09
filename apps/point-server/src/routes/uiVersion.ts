import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { emitUiReloadEvent } from "../realtime/socket.js";
import { env } from "../env.js";

function resolveUiVersion(): { version: string; source: string } | null {
  const candidates: Array<{ dir: string; source: string }> = [];
  if (env.UI_DIST_PATH) {
    candidates.push({ dir: path.resolve(env.UI_DIST_PATH), source: "UI_DIST_PATH" });
  }
  candidates.push({ dir: path.resolve("ui-dist"), source: "cwd/ui-dist" });
  candidates.push({
    dir: path.resolve("..", "kiosk-operator-app", "dist"),
    source: "sibling-dist",
  });

  for (const candidate of candidates) {
    const versionFile = path.join(candidate.dir, "ui-version.json");
    const moduleVersion = path.join(candidate.dir, "module-version.json");
    for (const file of [versionFile, moduleVersion]) {
      if (!existsSync(file)) continue;
      try {
        const raw = readFileSync(file, "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(raw) as { version?: string };
        if (parsed.version) return { version: parsed.version, source: candidate.source };
      } catch {
        // ignore
      }
    }
    if (existsSync(path.join(candidate.dir, "index.html"))) {
      return { version: "unknown", source: candidate.source };
    }
  }
  return null;
}

export async function uiVersionRoutes(app: FastifyInstance) {
  app.get("/ui-version", async () => {
    const info = resolveUiVersion();
    if (!info) return { version: null };
    return info;
  });

  // Local-only hook used by Operator Electron after applying a UI module zip.
  app.post("/internal/ui-reload", async (request) => {
    const body = (request.body ?? {}) as { version?: string };
    emitUiReloadEvent({ version: body.version });
    return { ok: true };
  });
}
