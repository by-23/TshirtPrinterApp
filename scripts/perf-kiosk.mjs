/**
 * Kiosk LAN performance probe (Playwright + CDP throttle).
 *
 * Usage:
 *   node scripts/perf-kiosk.mjs baseline
 *   node scripts/perf-kiosk.mjs step-01-code-split
 *
 * Env:
 *   KIOSK_PERF_URL  default http://127.0.0.1:5173/kiosk?native=1
 *   KIOSK_PERF_DIR  default docs/perf-reports
 */
import { chromium } from "../apps/point-server/node_modules/playwright/index.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.env.KIOSK_PERF_DIR
  ? path.resolve(process.env.KIOSK_PERF_DIR)
  : path.join(ROOT, "docs", "perf-reports");
const BASE_URL = process.env.KIOSK_PERF_URL || "http://127.0.0.1:5173/kiosk?native=1";
const LABEL = process.argv[2] || `run-${Date.now()}`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.join(OUT_DIR, "screenshots"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  // Emulate weak Android: 4× CPU slowdown + Slow 4G-ish network.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: "wifi",
  });

  const transfer = { requests: 0, bytes: 0, jsBytes: 0, cssBytes: 0, imageBytes: 0, otherBytes: 0 };
  const longTasks = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const headers = response.headers();
      const len = Number(headers["content-length"] || 0);
      let size = len;
      if (!size) {
        try {
          const buf = await response.body();
          size = buf.length;
        } catch {
          size = 0;
        }
      }
      transfer.requests += 1;
      transfer.bytes += size;
      const ct = headers["content-type"] || "";
      if (ct.includes("javascript") || url.includes(".js")) transfer.jsBytes += size;
      else if (ct.includes("css") || url.includes(".css")) transfer.cssBytes += size;
      else if (ct.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)) transfer.imageBytes += size;
      else transfer.otherBytes += size;
    } catch {
      // ignore
    }
  });

  await page.addInitScript(() => {
    const entries = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === "longtask" && e.duration >= 50) {
            entries.push({ start: e.startTime, duration: e.duration });
          }
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
      window.__kioskLongTasks = entries;
    } catch {
      window.__kioskLongTasks = entries;
    }
  });

  const t0 = Date.now();
  let homeReadyMs = null;
  let error = null;

  try {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector(".kiosk-theme-root, [aria-label='Переключатель языка'], .category-card, a[href*='/kiosk']", {
      timeout: 90_000,
    });
    // Prefer category grid / popular as "meaningful paint"
    await page.waitForTimeout(1500);
    homeReadyMs = Date.now() - t0;

    // Don't stall forever on Google Fonts / document.fonts.ready.
    await page.evaluate(async () => {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch {
        // ignore
      }
    });

    async function shot(name) {
      try {
        await page.screenshot({
          path: path.join(OUT_DIR, "screenshots", `${LABEL}-${name}.png`),
          fullPage: false,
          timeout: 8_000,
        });
      } catch {
        // Visual capture is best-effort under throttle.
      }
    }

    await shot("home");

    // Navigate to first gallery category if link exists
    const cat = page.locator('a[href*="/kiosk/category/"]').first();
    if (await cat.count()) {
      await cat.click();
      await page.waitForTimeout(2000);
      await shot("gallery");
      // Scroll gallery
      await page.mouse.wheel(0, 2400);
      await page.waitForTimeout(1500);
    }

    await page.waitForTimeout(2000);
    longTasks.push(...(await page.evaluate(() => window.__kioskLongTasks || [])));
  } catch (err) {
    error = err && err.message ? err.message : String(err);
    try {
      await page.screenshot({
        path: path.join(OUT_DIR, "screenshots", `${LABEL}-error.png`),
        fullPage: false,
        timeout: 5_000,
      });
    } catch {
      // ignore
    }
  }

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
      loadEventEnd: nav?.loadEventEnd ?? null,
      transferSize: nav?.transferSize ?? null,
      encodedBodySize: nav?.encodedBodySize ?? null,
      fcp: paint.find((p) => p.name === "first-contentful-paint")?.startTime ?? null,
    };
  });

  const result = {
    label: LABEL,
    at: new Date().toISOString(),
    url: BASE_URL,
    throttle: { cpuRate: 4, network: "slow-wifi-approx" },
    homeReadyMs,
    wallMs: Date.now() - t0,
    transfer,
    longTasks: {
      count: longTasks.length,
      totalMs: Math.round(longTasks.reduce((s, t) => s + t.duration, 0)),
      maxMs: longTasks.length ? Math.round(Math.max(...longTasks.map((t) => t.duration))) : 0,
    },
    navigation: perf,
    error,
  };

  const jsonPath = path.join(OUT_DIR, `${LABEL}.json`);
  await writeFile(jsonPath, JSON.stringify(result, null, 2), "utf8");

  const md = [
    `# ${LABEL}`,
    "",
    `- URL: ${BASE_URL}`,
    `- Home ready: ${homeReadyMs ?? "FAIL"} ms`,
    `- Wall: ${result.wallMs} ms`,
    `- Requests: ${transfer.requests}`,
    `- Transfer: ${(transfer.bytes / 1024 / 1024).toFixed(2)} MB (JS ${(transfer.jsBytes / 1024 / 1024).toFixed(2)} / CSS ${(transfer.cssBytes / 1024).toFixed(0)} KB / img ${(transfer.imageBytes / 1024 / 1024).toFixed(2)})`,
    `- Long tasks ≥50ms: ${result.longTasks.count} (max ${result.longTasks.maxMs} ms, sum ${result.longTasks.totalMs} ms)`,
    `- FCP: ${perf.fcp != null ? Math.round(perf.fcp) + " ms" : "n/a"}`,
    error ? `- Error: ${error}` : `- OK`,
    "",
  ].join("\n");
  await writeFile(path.join(OUT_DIR, `${LABEL}.md`), md, "utf8");

  console.log(md);
  await browser.close();
  if (error) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
