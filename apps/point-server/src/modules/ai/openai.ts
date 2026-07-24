import { getAiConfigRow, resolveOpenAIApiKey } from "./config.js";

const OPENAI_EDITS_URL = "https://api.openai.com/v1/images/edits";
const REQUEST_TIMEOUT_MS = 60_000;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
  }
  return { buffer: Buffer.from(dataUrl, "base64"), mimeType: "image/jpeg" };
}

/**
 * Premium stylization via OpenAI Images Edit (`gpt-image-1`).
 * No local fallback — callers surface 503 if this fails (customer paid for quality).
 */
export async function stylizeWithOpenAI(imageBase64: string, promptTemplate: string): Promise<string> {
  const row = await getAiConfigRow();
  const apiKey = resolveOpenAIApiKey(row);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { buffer, mimeType } = decodeDataUrl(imageBase64);
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const formData = new FormData();
  formData.append("image", new Blob([buffer], { type: mimeType }), `photo.${ext}`);
  formData.append("prompt", promptTemplate);
  formData.append("model", "gpt-image-1");
  formData.append("quality", "high");
  formData.append("size", "1024x1024");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(OPENAI_EDITS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI images/edits failed: ${res.status} ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("OpenAI images/edits returned no image data");
    }
    return `data:image/png;base64,${b64}`;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isOpenAIConfigured(): Promise<boolean> {
  const row = await getAiConfigRow();
  return Boolean(resolveOpenAIApiKey(row));
}
