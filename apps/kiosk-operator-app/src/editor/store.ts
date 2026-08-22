import { create } from "zustand";
import {
  FIXED_GARMENT_FABRIC,
  FIXED_GARMENT_SIZE,
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentHasSelectableBackSide,
  garmentUsesSizeFabric,
  type GarmentSide,
  type GarmentType,
  type PrintSize,
} from "@tshirt/shared-types";

/**
 * JSON snapshot (from fabric.Canvas#toJSON) of the design on a given side,
 * kept in memory so switching front/back doesn't lose work.
 */
export type CanvasSnapshots = Record<GarmentSide, string | null>;

/** Auto-detected print size (see `printSize.ts`), tracked per side like the canvas snapshot. */
export type PrintSizeBySide = Record<GarmentSide, PrintSize>;

/** Whether a side currently has artwork — empty sides must not add a print surcharge. */
export type HasDesignBySide = Record<GarmentSide, boolean>;

interface EditorState {
  garmentType: GarmentType;
  side: GarmentSide;
  color: string;
  size: string;
  fabricName: string;
  canvasSnapshots: CanvasSnapshots;
  printSizeBySide: PrintSizeBySide;
  hasDesignBySide: HasDesignBySide;
  hasSelection: boolean;
  setGarmentType: (type: GarmentType) => void;
  setSide: (side: GarmentSide) => void;
  setColor: (color: string) => void;
  setSize: (size: string) => void;
  setFabricName: (fabricName: string) => void;
  setCanvasSnapshot: (side: GarmentSide, json: string | null) => void;
  setPrintSize: (side: GarmentSide, printSize: PrintSize, hasDesign?: boolean) => void;
  setHasSelection: (hasSelection: boolean) => void;
  reset: () => void;
}

const initialState = {
  garmentType: "tshirt" as GarmentType,
  side: "front" as GarmentSide,
  color: GARMENT_COLORS[0]!.hex,
  size: GARMENT_SIZES[1],
  fabricName: GARMENT_FABRICS[0],
  canvasSnapshots: { front: null, back: null } as CanvasSnapshots,
  printSizeBySide: { front: "small", back: "small" } as PrintSizeBySide,
  hasDesignBySide: { front: false, back: false } as HasDesignBySide,
  hasSelection: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,
  // Switching type keeps the current design — only the mockup/print area
  // change. Cap/shopper pin size/fabric to fixed zero-surcharge values
  // (one-size/one-material); switching back to t-shirt/sweatshirt restores
  // the normal editable defaults. Shopper also forces `front`.
  setGarmentType: (garmentType) =>
    set((state) => ({
      garmentType,
      side: garmentHasSelectableBackSide(garmentType) ? state.side : "front",
      size: garmentUsesSizeFabric(garmentType) ? state.size : FIXED_GARMENT_SIZE,
      fabricName: garmentUsesSizeFabric(garmentType) ? state.fabricName : FIXED_GARMENT_FABRIC,
    })),
  setSide: (side) => set({ side }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
  setFabricName: (fabricName) => set({ fabricName }),
  setCanvasSnapshot: (side, json) =>
    set((state) => ({ canvasSnapshots: { ...state.canvasSnapshots, [side]: json } })),
  setPrintSize: (side, printSize, hasDesign) =>
    set((state) => ({
      printSizeBySide: { ...state.printSizeBySide, [side]: printSize },
      hasDesignBySide:
        hasDesign === undefined
          ? state.hasDesignBySide
          : { ...state.hasDesignBySide, [side]: hasDesign },
    })),
  setHasSelection: (hasSelection) => set({ hasSelection }),
  reset: () =>
    set({
      ...initialState,
      canvasSnapshots: { front: null, back: null },
      printSizeBySide: { front: "small", back: "small" },
      hasDesignBySide: { front: false, back: false },
    }),
}));
