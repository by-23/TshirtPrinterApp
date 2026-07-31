import { create } from "zustand";
import {
  DEFAULT_GARMENT_AVAILABILITY,
  type GarmentAvailabilityConfig,
  type GarmentAvailabilityEvent,
} from "@tshirt/shared-types";
import { fetchGarmentAvailabilityConfig, subscribeGarmentAvailabilityEvents } from "./pointServer.js";

interface GarmentAvailabilityStore {
  availability: GarmentAvailabilityConfig;
  adminOverrideActive: boolean;
  loaded: boolean;
  init: () => Promise<void>;
  setFromEvent: (payload: GarmentAvailabilityEvent) => void;
  setAvailability: (availability: GarmentAvailabilityConfig) => void;
}

export const useGarmentAvailabilityStore = create<GarmentAvailabilityStore>((set) => ({
  availability: DEFAULT_GARMENT_AVAILABILITY,
  adminOverrideActive: false,
  loaded: false,
  init: async () => {
    try {
      const config = await fetchGarmentAvailabilityConfig();
      set({
        availability: config.availability,
        adminOverrideActive: config.adminOverrideActive,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
  setFromEvent: (payload) =>
    set({
      availability: payload.availability,
      adminOverrideActive: payload.adminOverrideActive,
      loaded: true,
    }),
  setAvailability: (availability) => set({ availability }),
}));

/** Call once on editor/operator mount — fail-open to everything enabled. */
export function initGarmentAvailabilityConfig(): void {
  void useGarmentAvailabilityStore.getState().init();
}

/** Live updates when operator saves or central admin pushes an override. */
export function subscribeGarmentAvailabilityStore(): () => void {
  return subscribeGarmentAvailabilityEvents((payload) => {
    useGarmentAvailabilityStore.getState().setFromEvent(payload);
  });
}
