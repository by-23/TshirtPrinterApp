import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SAVE_PATH = "/__kiosk/save-theme-defaults";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer | string) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function patchIndexCss(cssPath: string, tokens: Record<string, string>) {
  let css = fs.readFileSync(cssPath, "utf-8");
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
    throw new Error(`Variables not found in index.css: ${missing.join(", ")}`);
  }

  fs.writeFileSync(cssPath, css, "utf-8");
}

/** Dev-only endpoint: writes Design Panel tokens into `src/index.css` :root defaults. */
export function kioskThemeSavePlugin(indexCssPath: string): Plugin {
  return {
    name: "kiosk-theme-save",
    configureServer(server) {
      server.middlewares.use(SAVE_PATH, (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        void (async () => {
          try {
            const raw = await readBody(req);
            const parsed = JSON.parse(raw) as { tokens?: Record<string, string> };

            if (!parsed.tokens || typeof parsed.tokens !== "object") {
              sendJson(res, 400, { error: "Expected { tokens: Record<string, string> }" });
              return;
            }

            patchIndexCss(indexCssPath, parsed.tokens);
            sendJson(res, 200, { ok: true });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Save failed";
            sendJson(res, 500, { error: message });
          }
        })();
      });
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

export const KIOSK_THEME_SAVE_PATH = SAVE_PATH;

export function resolveIndexCssPath(configDir: string) {
  return path.resolve(configDir, "src/index.css");
}
