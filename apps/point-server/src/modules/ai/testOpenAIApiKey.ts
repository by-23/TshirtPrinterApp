import type { AiApiKeyTestResult } from "@tshirt/shared-types";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const TEST_TIMEOUT_MS = 12_000;

/** Lightweight probe — list models; does not spend image-generation credits. */
export async function testOpenAIApiKey(apiKey: string): Promise<AiApiKeyTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, error: "Ключ не задан" };
  }

  try {
    const res = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${trimmed}` },
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ok: false, error: body?.error?.message ?? `OpenAI вернул HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("TimeoutError") || message.includes("timed out") || message.includes("aborted")) {
      return { ok: false, error: "OpenAI не ответил вовремя — проверьте интернет-соединение" };
    }
    return { ok: false, error: "Не удалось связаться с OpenAI" };
  }
}
