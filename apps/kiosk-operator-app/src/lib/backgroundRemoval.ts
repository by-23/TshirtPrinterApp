let warmed = false;

/**
 * Best-effort warm-up of `@imgly/background-removal`'s WASM/model bundle —
 * called once when the kiosk shell boots (see `KioskShell.tsx`) so the model
 * is (hopefully) already cached by the time the user reaches the AI-style
 * flow, instead of eating that latency on `/kiosk/ai` entry or mid-flow
 * (docs/PLAN.md risk: "Первый запуск @imgly/background-removal медленный").
 *
 * Uses the library's own `preload()` — which only downloads/initializes the
 * WASM+ONNX assets — rather than running a real `removeBackground()` pass,
 * since inference itself is a further multi-second main-thread cost that
 * warm-up doesn't need to pay. Deferred to `requestIdleCallback` and dynamic
 * `import()` so neither the module nor the download compete with whatever
 * the kiosk is rendering right after boot.
 */
export function warmBackgroundRemoval(): void {
  if (warmed) return;
  warmed = true;

  const run = () => {
    void import("@imgly/background-removal")
      .then(({ preload }) => preload())
      .catch(() => {
        // Best-effort only — a failed warm-up just means the first real removal pays the init cost instead.
      });
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run);
  } else {
    setTimeout(run, 0);
  }
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
  const { removeBackground } = await import("@imgly/background-removal");
  const blob = await removeBackground(dataUrl);
  return blobToDataUrl(blob);
}
