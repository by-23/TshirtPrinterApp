import { animeganModelFile, stylizeAnimeGan } from "./engines/animegan.js";
import { fastNeuralStyleModelFile, stylizeFastNeuralStyle } from "./engines/fastNeuralStyle.js";
import { isFilterKey, stylizeWithFilter } from "./engines/filters.js";

/**
 * Offline fallback for `POST /ai/stylize`, used when Pollinations is
 * unavailable (no internet, rate-limited, etc. — see `../routes.ts`).
 * `engineKey` is `{kind}:{variant}` (e.g. `animegan:hayao`,
 * `fast-neural-style:mosaic`, `filter:noir`) — see `AI_LOCAL_ENGINE_KEYS`
 * in `@tshirt/shared-types` for the full list.
 */
export async function stylizeLocally(imageBase64: string, engineKey: string): Promise<string> {
  const separatorIndex = engineKey.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error(`Malformed engineKey (expected "kind:variant"): ${engineKey}`);
  }
  const kind = engineKey.slice(0, separatorIndex);
  const variant = engineKey.slice(separatorIndex + 1);

  switch (kind) {
    case "animegan":
      return stylizeAnimeGan(imageBase64, variant);
    case "fast-neural-style":
      return stylizeFastNeuralStyle(imageBase64, variant);
    case "filter":
      if (!isFilterKey(variant)) throw new Error(`Unknown filter variant: ${variant}`);
      return stylizeWithFilter(imageBase64, variant);
    default:
      throw new Error(`Unknown engineKey kind: ${kind}`);
  }
}

/** `.onnx` file required for a given `engineKey`, or `null` for no-ML (filter) engines — used by `downloadModels.ts`. */
export function requiredModelFile(engineKey: string): string | null {
  const separatorIndex = engineKey.indexOf(":");
  if (separatorIndex === -1) return null;
  const kind = engineKey.slice(0, separatorIndex);
  const variant = engineKey.slice(separatorIndex + 1);
  if (kind === "animegan") return animeganModelFile(variant) ?? null;
  if (kind === "fast-neural-style") return fastNeuralStyleModelFile(variant) ?? null;
  return null;
}
