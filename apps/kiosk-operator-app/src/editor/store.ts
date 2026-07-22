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

interface EditorState {
  garmentType: GarmentType;
  side: GarmentSide;
  color: string;
  size: string;
  fabricName: string;
  canvasSnapshots: CanvasSnapshots;
  printSizeBySide: PrintSizeBySide;
  hasSelection: boolean;
  setGarmentType: (type: GarmentType) => void;
  setSide: (side: GarmentSide) => void;
  setColor: (color: string) => void;
  setSize: (size: string) => void;
  setFabricName: (fabricName: string) => void;
  setCanvasSnapshot: (side: GarmentSide, json: string | null) => void;
  setPrintSize: (side: GarmentSide, printSize: PrintSize) => void;
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
  hasSelection: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,
  // Every garment type has its own print area/mockup, so a type switch
  // always clears both side canvases (the caller — `GarmentTypeToggle` —
  // is responsible for confirming with the customer first when there's an
  // actual design to lose). Cap/shopper also pin size/fabric to fixed,
  // zero-surcharge values since they're one-size/one-material; switching
  // back to t-shirt/sweatshirt restores the normal editable defaults.
  setGarmentType: (garmentType) =>
    set((state) => ({
      garmentType,
      side: garmentHasSelectableBackSide(garmentType) ? state.side : "front",
      size: garmentUsesSizeFabric(garmentType) ? GARMENT_SIZES[1] : FIXED_GARMENT_SIZE,
      fabricName: garmentUsesSizeFabric(garmentType) ? GARMENT_FABRICS[0] : FIXED_GARMENT_FABRIC,
      canvasSnapshots: { front: null, back: null },
      printSizeBySide: { front: "small", back: "small" },
    })),
  setSide: (side) => set({ side }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
  setFabricName: (fabricName) => set({ fabricName }),
  setCanvasSnapshot: (side, json) =>
    set((state) => ({ canvasSnapshots: { ...state.canvasSnapshots, [side]: json } })),
  setPrintSize: (side, printSize) =>
    set((state) => ({ printSizeBySide: { ...state.printSizeBySide, [side]: printSize } })),
  setHasSelection: (hasSelection) => set({ hasSelection }),
  reset: () =>
    set({
      ...initialState,
      canvasSnapshots: { front: null, back: null },
      printSizeBySide: { front: "small", back: "small" },
    }),
}));
