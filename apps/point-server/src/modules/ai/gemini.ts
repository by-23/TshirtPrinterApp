import { getAiConfigRow, resolveGeminiApiKey } from "./config.js";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const REQUEST_TIMEOUT_MS = 60_000;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
  }
  return { buffer: Buffer.from(dataUrl, "base64"), mimeType: "image/jpeg" };
}

/**
 * Premium stylization via Gemini image model (image + text → image).
 * No local fallback — callers surface 503 if this fails.
 */
export async function stylizeWithGemini(imageBase64: string, promptTemplate: string): Promise<string> {
  const row = await getAiConfigRow();
  const apiKey = resolveGeminiApiKey(row);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const { buffer, mimeType } = decodeDataUrl(imageBase64);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: buffer.toString("base64") } },
          { text: promptTemplate },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini generateContent failed: ${res.status} ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
      }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new Error("Gemini generateContent returned no image data");
    }
    const outMime = imagePart.inlineData.mimeType ?? "image/png";
    return `data:${outMime};base64,${imagePart.inlineData.data}`;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isGeminiConfigured(): Promise<boolean> {
  const row = await getAiConfigRow();
  return Boolean(resolveGeminiApiKey(row));
}
