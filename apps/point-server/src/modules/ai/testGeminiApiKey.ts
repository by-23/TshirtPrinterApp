import type { AiApiKeyTestResult } from "@tshirt/shared-types";

const TEST_TIMEOUT_MS = 12_000;

/** Lightweight probe — list models; does not spend image-generation credits. */
export async function testGeminiApiKey(apiKey: string): Promise<AiApiKeyTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, error: "Ключ не задан" };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}&pageSize=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, error: body?.error?.message ?? `Gemini вернул HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("TimeoutError") || message.includes("timed out") || message.includes("aborted")) {
      return { ok: false, error: "Gemini не ответил вовремя — проверьте интернет-соединение" };
    }
    return { ok: false, error: "Не удалось связаться с Gemini" };
  }
}
