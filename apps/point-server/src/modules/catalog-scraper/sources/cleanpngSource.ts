import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import type { ScraperSource, SourceCandidate } from "./types.js";

const NAV_TIMEOUT_MS = 20_000;
const CHALLENGE_WAIT_MS = 15_000;

interface CleanPngListing {
  detailUrl: string;
  alt: string;
}

function slugify(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

async function collectListings(browser: Browser, query: string, limit: number): Promise<CleanPngListing[]> {
  const page = await browser.newPage();
  try {
    const slug = slugify(query);
    if (!slug) return [];
    await page.goto(`https://www.cleanpng.com/free/${slug}.html`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    // Runs inside the page's own (DOM-enabled) context — point-server's
    // tsconfig has no `dom` lib, so the callback params are typed loosely.
    const anchors = await page.$$eval("a.png-thumb", (nodes: any[]) =>
      nodes.map((node) => ({
        href: node.href as string,
        alt: (node.querySelector("img")?.getAttribute("alt") as string | null) ?? "",
      })),
    );
    return anchors.slice(0, limit).map((a) => ({ detailUrl: a.href, alt: a.alt }));
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

/**
 * Best-effort only: CleanPNG's search results load without JS, but the
 * actual "Free Download" link is gated behind a Cloudflare JS challenge that
 * a headless browser frequently can't clear (docs/PLAN.md Этап 3, risk
 * notes). Every failure here just means one fewer candidate from this
 * source — Pinterest/Giphy still carry the run either way (fail-open).
 */
async function downloadOne(browser: Browser, listing: CleanPngListing, outputDir: string, index: number): Promise<SourceCandidate | null> {
  const page = await browser.newPage();
  try {
    await page.goto(`${listing.detailUrl}download-png.html`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });

    // Cloudflare's interstitial auto-redirects once its JS challenge clears
    // on its own — give it a few seconds, then bail if we're still stuck.
    await page
      .waitForFunction("() => !document.title.includes('Just a moment')", { timeout: CHALLENGE_WAIT_MS })
      .catch(() => null);
    if ((await page.title()).includes("Just a moment")) return null;

    const downloadHref = await page
      .$eval("a[href$='.png'], a[download]", (node: any) => node.href as string)
      .catch(() => null);
    if (!downloadHref) return null;

    const response = await page.request.get(downloadHref, { timeout: NAV_TIMEOUT_MS });
    if (!response.ok()) return null;

    const buffer = await response.body();
    const filePath = path.join(outputDir, `cleanpng-${index}-${Date.now()}.png`);
    await writeFile(filePath, buffer);
    return { externalId: downloadHref, filePath, alt: listing.alt || "cleanpng" };
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

export const cleanpngSource: ScraperSource = {
  id: "cleanpng",
  label: "CleanPNG",
  async search({ query, outputDir, limit }) {
    const browser = await chromium.launch({ headless: true });
    try {
      const listings = await collectListings(browser, query, limit);
      const results: SourceCandidate[] = [];
      for (const [index, listing] of listings.entries()) {
        if (results.length >= limit) break;
        const candidate = await downloadOne(browser, listing, outputDir, index);
        if (candidate) results.push(candidate);
      }
      return results;
    } finally {
      await browser.close();
    }
  },
};
