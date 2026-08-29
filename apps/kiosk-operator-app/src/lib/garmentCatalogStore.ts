import { create } from "zustand";
import { DEFAULT_GARMENT_CATALOG, withGarmentCatalogDefaults, type GarmentCatalogConfig } from "@tshirt/shared-types";
import { fetchGarmentCatalog, subscribeGarmentCatalogEvents } from "./pointServer.js";

interface GarmentCatalogStore {
  catalog: GarmentCatalogConfig;
  loaded: boolean;
  init: () => Promise<void>;
  setCatalog: (catalog: GarmentCatalogConfig) => void;
}

export const useGarmentCatalogStore = create<GarmentCatalogStore>((set) => ({
  catalog: DEFAULT_GARMENT_CATALOG,
  loaded: false,
  init: async () => {
    try {
      const catalog = await fetchGarmentCatalog();
      set({ catalog: withGarmentCatalogDefaults(catalog), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setCatalog: (catalog) => set({ catalog: withGarmentCatalogDefaults(catalog), loaded: true }),
}));

export function initGarmentCatalog(): void {
  void useGarmentCatalogStore.getState().init();
}

export function subscribeGarmentCatalogStore(): () => void {
  return subscribeGarmentCatalogEvents((catalog) => {
    useGarmentCatalogStore.getState().setCatalog(catalog);
  });
}
