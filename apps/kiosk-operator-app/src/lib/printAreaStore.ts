import { create } from "zustand";
import {
  DEFAULT_PRINT_AREAS,
  type GarmentSide,
  type GarmentType,
  type PrintAreaConfig,
  type PrintAreaRect,
} from "@tshirt/shared-types";
import { fetchPrintAreaConfig } from "./pointServer.js";

interface PrintAreaStore {
  areas: PrintAreaConfig;
  loaded: boolean;
  init: () => Promise<void>;
  setAreas: (areas: PrintAreaConfig) => void;
  getArea: (type: GarmentType, side: GarmentSide) => PrintAreaRect;
}

export const usePrintAreaStore = create<PrintAreaStore>((set, get) => ({
  areas: DEFAULT_PRINT_AREAS,
  loaded: false,
  init: async () => {
    if (get().loaded) return;
    try {
      const config = await fetchPrintAreaConfig();
      set({ areas: config.areas, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setAreas: (areas) => set({ areas }),
  getArea: (type, side) => get().areas[type][side],
}));

/** Call once on editor/operator mount — fail-open to `DEFAULT_PRINT_AREAS`. */
export function initPrintAreaConfig(): void {
  void usePrintAreaStore.getState().init();
}
