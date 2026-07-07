import { removeBackground } from "@imgly/background-removal";

let warmed = false;

/** 1x1 transparent PNG — cheap enough to not matter, just forces the WASM/model download+init ahead of the real first use. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * Best-effort warm-up of `@imgly/background-removal`'s WASM/model bundle —
 * call once when entering `/kiosk/ai` so the model is (hopefully) already
 * loaded by the time the user reaches the result step, instead of eating
 * that latency mid-flow (docs/PLAN.md risk: "Первый запуск
 * @imgly/background-removal медленный").
 */
export function warmBackgroundRemoval(): void {
  if (warmed) return;
  warmed = true;
  void removeBackground(TINY_PNG).catch(() => {
    // Best-effort only — a failed warm-up just means the first real removal pays the init cost instead.
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error instanceof Error ? reader.error : new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

/** Runs client-side background removal (WASM/ONNX, entirely offline — see docs/PLAN.md) on a data URL, returning a transparent-background PNG data URL. */
export async function removeImageBackground(dataUrl: string): Promise<string> {
  const blob = await removeBackground(dataUrl);
  return blobToDataUrl(blob);
}
