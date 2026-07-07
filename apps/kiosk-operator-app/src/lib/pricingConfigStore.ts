import { create } from "zustand";
import { DEFAULT_PRICE_CONFIG, type PriceConfig } from "@tshirt/shared-types";
import { fetchPriceConfig, subscribePricingEvents } from "./pointServer.js";

interface PricingConfigState {
  config: PriceConfig;
}

/**
 * Effective (global + point override) price config, cached from
 * point-server's `GET /pricing` (itself cached from central-relay's last
 * `sync:snapshot`, Этап 7). Starts as `DEFAULT_PRICE_CONFIG` so the editor
 * never blocks on a network round-trip; fail-open if point-server is
 * unreachable or the point never synced yet.
 */
export const usePricingConfigStore = create<PricingConfigState>(() => ({
  config: DEFAULT_PRICE_CONFIG,
}));

let initialized = false;

/** Call once (e.g. from the editor route) to fetch + subscribe to live updates. Safe to call repeatedly. */
export function initPricingConfig(): void {
  if (initialized) return;
  initialized = true;

  fetchPriceConfig()
    .then((config) => usePricingConfigStore.setState({ config }))
    .catch(() => {
      // Keep the default — point-server unreachable or never synced.
    });

  subscribePricingEvents((config) => usePricingConfigStore.setState({ config }));
}
