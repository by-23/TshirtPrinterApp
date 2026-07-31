import { existsSync } from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-node";
import { dataPath } from "../../../lib/dataDir.js";

/**
 * Where downloaded `.onnx` weights live — under DATA_DIR, populated on first
 * boot by `downloadModels.ts`.
 */
export const AI_MODELS_DIR = dataPath("ai-models");

const EXECUTION_PROVIDERS_PRIMARY: ort.InferenceSession.ExecutionProviderConfig[] =
  process.platform === "win32" ? ["dml", "cpu"] : ["cpu"];

const sessions = new Map<string, Promise<ort.InferenceSession>>();

/**
 * Lazily creates and caches one `InferenceSession` per model file — the
 * expensive part (loading weights, tens of ms to ~1s) only happens once per
 * `.onnx` file, not per stylize request. Tries DirectML on Windows first for
 * a speed boost, falling back to plain CPU if DirectML isn't usable on this
 * machine (e.g. no compatible GPU driver) — same fail-open posture as the
 * rest of the AI module.
 */
export function getSession(modelFileName: string): Promise<ort.InferenceSession> {
  let promise = sessions.get(modelFileName);
  if (!promise) {
    const modelPath = path.join(AI_MODELS_DIR, modelFileName);
    promise = ort.InferenceSession.create(modelPath, { executionProviders: EXECUTION_PROVIDERS_PRIMARY }).catch((err) => {
      if (EXECUTION_PROVIDERS_PRIMARY.length === 1) throw err;
      return ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"] });
    });
    // Don't cache a rejected load — a later retry (e.g. after the model
    // finishes downloading) should get a fresh attempt instead of the same
    // stuck rejection forever.
    promise.catch(() => sessions.delete(modelFileName));
    sessions.set(modelFileName, promise);
  }
  return promise;
}

export function isModelDownloaded(modelFileName: string): boolean {
  return existsSync(path.join(AI_MODELS_DIR, modelFileName));
}
