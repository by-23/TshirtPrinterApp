import sharp from "sharp";
import * as ort from "onnxruntime-node";
import { decodeDataUrl, encodeDataUrl, clampByte } from "../imageIO.js";
import { getSession } from "../modelRegistry.js";

/**
 * AnimeGANv2 ONNX exports — float32 normalized to `[-1, 1]` in and out,
 * fixed 512x512 spatial input. The `hayao`/`shinkai`/`paprika` weights
 * (`vumichien/AnimeGANv2_*` on Hugging Face) come from the *original*
 * TensorFlow implementation and expect **NHWC** (`[1, H, W, 3]`); `facepaint`
 * (`akhaliq/AnimeGANv2-ONNX`, converted from `bryandlee/animegan2-pytorch`)
 * expects **NCHW** (`[1, 3, H, W]`) instead — confirmed by each model's own
 * reported input shape (mismatched layout surfaces as an onnxruntime
 * "invalid dimensions" error at the channel axis). Hence the per-variant
 * `LAYOUTS` map below rather than one shared preprocessing path.
 *
 * License: AnimeGANv2 weights are distributed for non-commercial use only
 * without the author's separate permission — see the note in
 * `defaultStyles.ts`. Included here on explicit request.
 */
const MODEL_FILES: Record<string, string> = {
  hayao: "animegan-hayao.onnx",
  shinkai: "animegan-shinkai.onnx",
  paprika: "animegan-paprika.onnx",
  facepaint: "animegan-facepaint.onnx",
};

type Layout = "nchw" | "nhwc";

const LAYOUTS: Record<string, Layout> = {
  hayao: "nhwc",
  shinkai: "nhwc",
  paprika: "nhwc",
  facepaint: "nchw",
};

const TARGET_SIZE = 512;

export function animeganModelFile(variant: string): string | undefined {
  return MODEL_FILES[variant];
}

export async function stylizeAnimeGan(imageBase64: string, variant: string): Promise<string> {
  const modelFile = MODEL_FILES[variant];
  const layout = LAYOUTS[variant];
  if (!modelFile || !layout) {
    throw new Error(`Unknown AnimeGAN variant: ${variant}`);
  }

  const { buffer } = decodeDataUrl(imageBase64);
  const rotated = sharp(buffer).rotate();
  const meta = await rotated.metadata();
  const originalWidth = meta.width ?? TARGET_SIZE;
  const originalHeight = meta.height ?? TARGET_SIZE;

  const { data } = await rotated
    .resize(TARGET_SIZE, TARGET_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = TARGET_SIZE * TARGET_SIZE;
  const input = new Float32Array(3 * pixelCount);
  if (layout === "nchw") {
    for (let i = 0; i < pixelCount; i++) {
      input[i] = data[i * 3]! / 127.5 - 1;
      input[pixelCount + i] = data[i * 3 + 1]! / 127.5 - 1;
      input[2 * pixelCount + i] = data[i * 3 + 2]! / 127.5 - 1;
    }
  } else {
    for (let i = 0; i < pixelCount; i++) {
      input[i * 3] = data[i * 3]! / 127.5 - 1;
      input[i * 3 + 1] = data[i * 3 + 1]! / 127.5 - 1;
      input[i * 3 + 2] = data[i * 3 + 2]! / 127.5 - 1;
    }
  }

  const session = await getSession(modelFile);
  const inputName = session.inputNames[0]!;
  const outputName = session.outputNames[0]!;
  const dims = layout === "nchw" ? [1, 3, TARGET_SIZE, TARGET_SIZE] : [1, TARGET_SIZE, TARGET_SIZE, 3];
  const tensor = new ort.Tensor("float32", input, dims);
  const results = await session.run({ [inputName]: tensor });
  const output = results[outputName]!.data as Float32Array;

  const hwc = Buffer.alloc(pixelCount * 3);
  if (layout === "nchw") {
    for (let i = 0; i < pixelCount; i++) {
      hwc[i * 3] = clampByte((output[i]! + 1) * 127.5);
      hwc[i * 3 + 1] = clampByte((output[pixelCount + i]! + 1) * 127.5);
      hwc[i * 3 + 2] = clampByte((output[2 * pixelCount + i]! + 1) * 127.5);
    }
  } else {
    for (let i = 0; i < pixelCount; i++) {
      hwc[i * 3] = clampByte((output[i * 3]! + 1) * 127.5);
      hwc[i * 3 + 1] = clampByte((output[i * 3 + 1]! + 1) * 127.5);
      hwc[i * 3 + 2] = clampByte((output[i * 3 + 2]! + 1) * 127.5);
    }
  }

  const styledBuffer = await sharp(hwc, { raw: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 3 } })
    .resize(originalWidth, originalHeight, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return encodeDataUrl(styledBuffer, "image/jpeg");
}
