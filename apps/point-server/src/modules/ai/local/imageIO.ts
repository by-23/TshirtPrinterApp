/**
 * Shared data-URL <-> Buffer helpers for the local stylization engines
 * (`engines/*.ts`) and `previewCache.ts`. Mirrors the (unexported) helper in
 * `../pollinations.ts` — kept as its own tiny module rather than importing
 * from `pollinations.ts` so the offline engines have zero dependency on the
 * cloud path.
 */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (match) {
    return { buffer: Buffer.from(match[2]!, "base64"), mimeType: match[1]! };
  }
  return { buffer: Buffer.from(dataUrl, "base64"), mimeType: "image/jpeg" };
}

export function encodeDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
