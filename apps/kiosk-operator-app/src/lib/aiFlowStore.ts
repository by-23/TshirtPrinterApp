import { create } from "zustand";
import type { AiProvider } from "@tshirt/shared-types";

/** Wizard steps for `/kiosk/ai` (Этап 9) — see `routes/kiosk/ai/AiFlow.tsx`. */
export type AiFlowStep = "source" | "camera" | "qr" | "style" | "processing" | "result";

export type AiProcessingStage = "stylizing" | "removingBackground" | null;

interface AiFlowState {
  step: AiFlowStep;
  /** Raw photo (camera snapshot or phone upload), data URL — shown as "ДО" on the result screen. */
  sourcePhoto: string | null;
  selectedStyleKey: string | null;
  /** Stylization backend — standard (free) or ChatGPT/Gemini (surcharge). */
  aiProvider: AiProvider;
  /** When true, client-side background removal runs after stylization. Off by default. */
  removeBackground: boolean;
  /** Stylized output, background still present — kept only to feed background-removal; not shown to the user. */
  stylizedImage: string | null;
  /** Stylized + background removed — the actual print-ready design. */
  finalImage: string | null;
  processingStage: AiProcessingStage;
  error: string | null;

  setStep: (step: AiFlowStep) => void;
  setSourcePhoto: (photo: string) => void;
  setSelectedStyleKey: (key: string | null) => void;
  setAiProvider: (provider: AiProvider) => void;
  setRemoveBackground: (remove: boolean) => void;
  setStylizedImage: (image: string | null) => void;
  setFinalImage: (image: string | null) => void;
  setProcessingStage: (stage: AiProcessingStage) => void;
  setError: (error: string | null) => void;
  /** Back to style selection with the same source photo — "Выбрать другой стиль" on the result screen. */
  restartStyleSelection: () => void;
  /**
   * Clears photo/result state after the design is placed on the editor canvas,
   * but keeps `aiProvider` so checkout can still apply the premium surcharge.
   */
  clearAfterEditorApply: () => void;
  reset: () => void;
}

const initialState = {
  step: "source" as AiFlowStep,
  sourcePhoto: null as string | null,
  selectedStyleKey: null as string | null,
  aiProvider: "standard" as AiProvider,
  removeBackground: false,
  stylizedImage: null as string | null,
  finalImage: null as string | null,
  processingStage: null as AiProcessingStage,
  error: null as string | null,
};

export const useAiFlowStore = create<AiFlowState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setSourcePhoto: (sourcePhoto) => set({ sourcePhoto }),
  setSelectedStyleKey: (selectedStyleKey) => set({ selectedStyleKey }),
  setAiProvider: (aiProvider) => set({ aiProvider, selectedStyleKey: null }),
  setRemoveBackground: (removeBackground) => set({ removeBackground }),
  setStylizedImage: (stylizedImage) => set({ stylizedImage }),
  setFinalImage: (finalImage) => set({ finalImage }),
  setProcessingStage: (processingStage) => set({ processingStage }),
  setError: (error) => set({ error }),
  restartStyleSelection: () =>
    set({ step: "style", selectedStyleKey: null, stylizedImage: null, finalImage: null, error: null }),
  clearAfterEditorApply: () =>
    set({
      step: "source",
      sourcePhoto: null,
      selectedStyleKey: null,
      removeBackground: false,
      stylizedImage: null,
      finalImage: null,
      processingStage: null,
      error: null,
    }),
  reset: () => set({ ...initialState }),
}));
