import type { GiphyApiKeyTestResult } from "@tshirt/shared-types";

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/stickers/search";
const TEST_TIMEOUT_MS = 12_000;

interface GiphyErrorBody {
  message?: string;
  meta?: { msg?: string; status?: number };
  data?: unknown[];
}

/** Lightweight probe — same stickers/search endpoint the scraper uses in production. */
export async function testGiphyApiKey(apiKey: string): Promise<GiphyApiKeyTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, error: "Ключ не задан" };
  }

  try {
    const url = new URL(GIPHY_SEARCH_URL);
    url.searchParams.set("api_key", trimmed);
    url.searchParams.set("q", "sticker");
    url.searchParams.set("limit", "1");
    url.searchParams.set("rating", "g");

    const res = await fetch(url, { signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
    const body = (await res.json().catch(() => null)) as GiphyErrorBody | null;

    if (!res.ok) {
      const message = body?.message ?? body?.meta?.msg ?? `Giphy вернул HTTP ${res.status}`;
      return { ok: false, error: message };
    }

    const stickerCount = Array.isArray(body?.data) ? body.data.length : 0;
    return { ok: true, stickerCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("TimeoutError") || message.includes("timed out")) {
      return { ok: false, error: "Giphy не ответил вовремя — проверьте интернет-соединение" };
    }
    return { ok: false, error: "Не удалось связаться с Giphy" };
  }
}
