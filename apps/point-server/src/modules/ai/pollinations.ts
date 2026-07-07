import { env } from "../../env.js";

const POLLINATIONS_EDIT_URL = "https://gen.pollinations.ai/v1/images/edits";
/**
 * Bounded so a point with no internet fails fast into the local-engine
 * fallback (see `routes.ts`) instead of making the customer wait the better
 * part of a minute first. Still generous enough for a normal (if slow)
 * mobile-hotspot-class connection to complete a real style-transfer call.
 */
const REQUEST_TIMEOUT_MS = 12_000;

function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
  }
  return { buffer: Buffer.from(dataUrl, "base64"), mimeType: "image/jpeg" };
}

/**
 * Calls Pollinations' image-edit endpoint to restyle `imageBase64` per
 * `promptTemplate` (see `defaultStyles.ts`). Note this is the *current*
 * Pollinations API surface (`gen.pollinations.ai/v1/images/edits`,
 * multipart upload, `model=kontext`, bearer token) — docs/PLAN.md originally
 * assumed a fully anonymous API; Pollinations has since moved to
 * token-gated access (see `env.POLLINATIONS_API_TOKEN`). Throws if the
 * token is unset or the request fails/times out — callers (routes.ts)
 * translate that into a 503, matching the project's fail-open posture for
 * anything that requires internet.
 */
export async function stylizeWithPollinations(imageBase64: string, promptTemplate: string): Promise<string> {
  const { POLLINATIONS_API_TOKEN } = env;
  if (!POLLINATIONS_API_TOKEN) {
    throw new Error("POLLINATIONS_API_TOKEN is not configured");
  }

  const { buffer, mimeType } = decodeDataUrl(imageBase64);
  const formData = new FormData();
  formData.append("image", new Blob([buffer], { type: mimeType }), "photo.jpg");
  formData.append("prompt", promptTemplate);
  formData.append("model", "kontext");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(POLLINATIONS_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${POLLINATIONS_API_TOKEN}` },
      body: formData,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Pollinations request failed: ${res.status}`);
    }
    const resultBuffer = Buffer.from(await res.arrayBuffer());
    const resultMime = res.headers.get("content-type") ?? "image/png";
    return `data:${resultMime};base64,${resultBuffer.toString("base64")}`;
  } finally {
    clearTimeout(timeout);
  }
}
