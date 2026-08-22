import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";

const SAVE_PATH = "/__kiosk/save-theme-defaults";

function resolveIndexCssPath(): string | null {
  const candidates = [
    path.resolve("..", "kiosk-operator-app", "src", "index.css"),
    path.resolve("..", "..", "apps", "kiosk-operator-app", "src", "index.css"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function insertIntoRoot(css: string, declarations: string): string {
  const match = css.match(/:root\s*\{/);
  if (!match || match.index === undefined) {
    throw new Error(":root block not found in index.css");
  }
  const insertAt = match.index + match[0].length;
  return `${css.slice(0, insertAt)}\n${declarations}${css.slice(insertAt)}`;
}

function patchIndexCss(cssPath: string, tokens: Record<string, string>) {
  let css = readFileSync(cssPath, "utf-8");
  const missing: string[] = [];

  for (const [key, value] of Object.entries(tokens)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(${escapedKey}\\s*:\\s*)[^;]+(;)`, "m");

    if (pattern.test(css)) {
      css = css.replace(pattern, `$1${value}$2`);
    } else {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const declarations = missing.map((key) => `  ${key}: ${tokens[key]};`).join("\n") + "\n";
    css = insertIntoRoot(css, declarations);
  }

  writeFileSync(cssPath, css, "utf-8");
}

/** Same contract as the Vite kioskThemeSavePlugin — so design panels work on point-server / dist. */
export async function themeSaveRoutes(app: FastifyInstance) {
  app.post(SAVE_PATH, async (request, reply) => {
    const cssPath = resolveIndexCssPath();
    if (!cssPath) {
      return reply.status(404).send({ error: "index.css not found" });
    }

    const body = (request.body ?? {}) as { tokens?: Record<string, string> };
    if (!body.tokens || typeof body.tokens !== "object") {
      return reply.status(400).send({ error: "Expected { tokens: Record<string, string> }" });
    }

    try {
      patchIndexCss(cssPath, body.tokens);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      return reply.status(500).send({ error: message });
    }
  });
}
