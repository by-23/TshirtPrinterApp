import { create } from "zustand";
import type { GarmentSide, GarmentType, Order } from "@tshirt/shared-types";
import type { PriceBreakdownLine } from "@tshirt/shared-pricing";

/**
 * Draft order captured from the editor at the moment "Печать" is pressed,
 * plus the server-created `Order` once `createOrder()` resolves. Kept as its
 * own store (rather than piggy-backing on `editorStore`) since it outlives
 * the editor screen and is read exclusively by `/kiosk/checkout`.
 */
export interface CheckoutGarment {
  type: GarmentType;
  color: string;
  size: string;
  fabricName: string;
  side: GarmentSide;
  /** JSON snapshot (fabric.Canvas#toJSON) of the ordered side, for the read-only checkout preview. */
  canvasSnapshot: string | null;
  /** Sides that actually have artwork — used for «Сторона печати» and preview pills. */
  designedSides?: GarmentSide[];
}

interface CheckoutState {
  garment: CheckoutGarment | null;
  priceBreakdown: PriceBreakdownLine[];
  order: Order | null;
  setDraft: (garment: CheckoutGarment, priceBreakdown: PriceBreakdownLine[]) => void;
  setOrder: (order: Order) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  garment: null,
  priceBreakdown: [],
  order: null,
  setDraft: (garment, priceBreakdown) => set({ garment, priceBreakdown }),
  setOrder: (order) => set({ order }),
  reset: () => set({ garment: null, priceBreakdown: [], order: null }),
}));
