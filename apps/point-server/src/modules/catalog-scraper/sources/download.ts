import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Shared by the Giphy/CleanPNG sources — plain `fetch` to disk with a hard timeout, since neither needs a browser to grab the actual file bytes. */
export async function downloadToFile(
  url: string,
  outputDir: string,
  filename: string,
  timeoutMs = 15_000,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`download failed (${res.status}): ${url}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const destination = path.join(outputDir, filename);
    await writeFile(destination, buffer);
    return destination;
  } finally {
    clearTimeout(timer);
  }
}
