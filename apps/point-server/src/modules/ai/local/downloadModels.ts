import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyBaseLogger } from "fastify";
import { AI_MODELS_DIR } from "./modelRegistry.js";

/**
 * One entry per `.onnx` file referenced by `engines/animegan.ts` and
 * `engines/fastNeuralStyle.ts` (filenames must match exactly). Fast Neural
 * Style comes from the MIT-licensed `onnx/models` repo; AnimeGANv2 comes
 * from Hugging Face `vumichien`/`akhaliq` conversions (non-commercial
 * license — see the note in `defaultStyles.ts`).
 */
const MODEL_URLS: Record<string, string> = {
  "fast-neural-style-mosaic.onnx":
    "https://github.com/onnx/models/raw/main/validated/vision/style_transfer/fast_neural_style/model/mosaic-9.onnx",
  "fast-neural-style-candy.onnx":
    "https://github.com/onnx/models/raw/main/validated/vision/style_transfer/fast_neural_style/model/candy-9.onnx",
  "fast-neural-style-rain-princess.onnx":
    "https://github.com/onnx/models/raw/main/validated/vision/style_transfer/fast_neural_style/model/rain-princess-9.onnx",
  "fast-neural-style-udnie.onnx":
    "https://github.com/onnx/models/raw/main/validated/vision/style_transfer/fast_neural_style/model/udnie-9.onnx",
  "fast-neural-style-pointilism.onnx":
    "https://github.com/onnx/models/raw/main/validated/vision/style_transfer/fast_neural_style/model/pointilism-9.onnx",
  "animegan-hayao.onnx": "https://huggingface.co/vumichien/AnimeGANv2_Hayao/resolve/main/AnimeGANv2_Hayao.onnx",
  "animegan-shinkai.onnx": "https://huggingface.co/vumichien/AnimeGANv2_Shinkai/resolve/main/AnimeGANv2_Shinkai.onnx",
  "animegan-paprika.onnx": "https://huggingface.co/vumichien/AnimeGANv2_Paprika/resolve/main/AnimeGANv2_Paprika.onnx",
  "animegan-facepaint.onnx": "https://huggingface.co/akhaliq/AnimeGANv2-ONNX/resolve/main/face_paint_512_v2_0.onnx",
};

/**
 * Downloads any missing local-stylization `.onnx` weights into
 * `data/ai-models/` (gitignored) — best-effort/fail-open, matching the
 * project's offline-first posture (see `env.ts`'s `POLLINATIONS_API_TOKEN`
 * comment for the same pattern): a failed download just leaves that
 * `engineKey` unavailable until it eventually succeeds (retried on every
 * boot). Once downloaded, the point works fully offline — no re-download
 * on subsequent boots. Called fire-and-forget from `index.ts` after the
 * server starts listening, so it never blocks kiosk/operator traffic.
 */
export async function ensureAiModelsDownloaded(logger: FastifyBaseLogger): Promise<void> {
  mkdirSync(AI_MODELS_DIR, { recursive: true });
  for (const [fileName, url] of Object.entries(MODEL_URLS)) {
    const dest = path.join(AI_MODELS_DIR, fileName);
    if (existsSync(dest)) continue;
    try {
      logger.info(`Downloading AI style model ${fileName}…`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buffer);
      logger.info(`Downloaded AI style model ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    } catch (err) {
      logger.warn(
        err,
        `Failed to download AI style model ${fileName} — its style(s) will stay unavailable offline until this succeeds on a later boot`,
      );
    }
  }
}
