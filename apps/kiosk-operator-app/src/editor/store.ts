import { create } from "zustand";
import {
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  type GarmentSide,
  type GarmentType,
} from "@tshirt/shared-types";

/**
 * JSON snapshot (from fabric.Canvas#toJSON) of the design on a given side,
 * kept in memory so switching front/back doesn't lose work.
 */
export type CanvasSnapshots = Record<GarmentSide, string | null>;

interface EditorState {
  garmentType: GarmentType;
  side: GarmentSide;
  color: string;
  size: string;
  fabricName: string;
  canvasSnapshots: CanvasSnapshots;
  hasSelection: boolean;
  setGarmentType: (type: GarmentType) => void;
  setSide: (side: GarmentSide) => void;
  setColor: (color: string) => void;
  setSize: (size: string) => void;
  setFabricName: (fabricName: string) => void;
  setCanvasSnapshot: (side: GarmentSide, json: string | null) => void;
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
  hasSelection: false,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...initialState,
  setGarmentType: (garmentType) => set({ garmentType }),
  setSide: (side) => set({ side }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
  setFabricName: (fabricName) => set({ fabricName }),
  setCanvasSnapshot: (side, json) =>
    set((state) => ({ canvasSnapshots: { ...state.canvasSnapshots, [side]: json } })),
  setHasSelection: (hasSelection) => set({ hasSelection }),
  reset: () => set({ ...initialState, canvasSnapshots: { front: null, back: null } }),
}));
