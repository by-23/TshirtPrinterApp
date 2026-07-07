import sharp from "sharp";
import * as ort from "onnxruntime-node";
import { decodeDataUrl, encodeDataUrl, clampByte } from "../imageIO.js";
import { getSession } from "../modelRegistry.js";

/**
 * ONNX Model Zoo's "Fast Neural Style" models (`onnx/models`, MIT-licensed
 * repo) — Perceptual Losses style-transfer nets, NCHW float32 `[0, 255]` in
 * and out. Despite the ONNX graph nominally allowing dynamic H/W, this
 * particular export (`fast_neural_style/model/*-9.onnx`) rejects anything
 * but its originally-traced **224x224** — confirmed by onnxruntime's
 * "invalid dimensions ... Expected: 224" at inference time for any other
 * size. See
 * https://github.com/onnx/models/tree/main/validated/vision/style_transfer/fast_neural_style
 * for the reference preprocessing this mirrors.
 */
const MODEL_FILES: Record<string, string> = {
  mosaic: "fast-neural-style-mosaic.onnx",
  candy: "fast-neural-style-candy.onnx",
  "rain-princess": "fast-neural-style-rain-princess.onnx",
  udnie: "fast-neural-style-udnie.onnx",
  pointilism: "fast-neural-style-pointilism.onnx",
};

/** Fixed spatial size this particular ONNX export was traced with — see the module comment above. */
const TARGET_SIZE = 224;

export function fastNeuralStyleModelFile(variant: string): string | undefined {
  return MODEL_FILES[variant];
}

export async function stylizeFastNeuralStyle(imageBase64: string, variant: string): Promise<string> {
  const modelFile = MODEL_FILES[variant];
  if (!modelFile) {
    throw new Error(`Unknown fast-neural-style variant: ${variant}`);
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

  const chw = new Float32Array(3 * pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    chw[i] = data[i * 3]!;
    chw[pixelCount + i] = data[i * 3 + 1]!;
    chw[2 * pixelCount + i] = data[i * 3 + 2]!;
  }

  const session = await getSession(modelFile);
  const inputName = session.inputNames[0]!;
  const outputName = session.outputNames[0]!;
  const tensor = new ort.Tensor("float32", chw, [1, 3, TARGET_SIZE, TARGET_SIZE]);
  const results = await session.run({ [inputName]: tensor });
  const output = results[outputName]!.data as Float32Array;

  const hwc = Buffer.alloc(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    hwc[i * 3] = clampByte(output[i]!);
    hwc[i * 3 + 1] = clampByte(output[pixelCount + i]!);
    hwc[i * 3 + 2] = clampByte(output[2 * pixelCount + i]!);
  }

  const styledBuffer = await sharp(hwc, { raw: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 3 } })
    .resize(originalWidth, originalHeight, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return encodeDataUrl(styledBuffer, "image/jpeg");
}
