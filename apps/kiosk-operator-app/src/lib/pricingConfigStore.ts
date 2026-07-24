import { create } from "zustand";
import { DEFAULT_PRICE_CONFIG, type PriceConfig } from "@tshirt/shared-types";
import { fetchPriceConfig, subscribePricingEvents } from "./pointServer.js";

interface PricingConfigState {
  config: PriceConfig;
}

/** Fills missing maps (e.g. older synced configs without AI surcharges / coverage thresholds). */
function normalizePriceConfig(config: PriceConfig): PriceConfig {
  return {
    ...DEFAULT_PRICE_CONFIG,
    ...config,
    basePriceTenge: { ...DEFAULT_PRICE_CONFIG.basePriceTenge, ...config.basePriceTenge },
    fabricSurchargeTenge: { ...DEFAULT_PRICE_CONFIG.fabricSurchargeTenge, ...config.fabricSurchargeTenge },
    sizeSurchargeTenge: { ...DEFAULT_PRICE_CONFIG.sizeSurchargeTenge, ...config.sizeSurchargeTenge },
    printSizeSurchargeTenge: {
      ...DEFAULT_PRICE_CONFIG.printSizeSurchargeTenge,
      ...config.printSizeSurchargeTenge,
    },
    aiProviderSurchargeTenge: {
      ...DEFAULT_PRICE_CONFIG.aiProviderSurchargeTenge,
      ...config.aiProviderSurchargeTenge,
    },
    printCoverageThresholds: {
      ...DEFAULT_PRICE_CONFIG.printCoverageThresholds,
      ...config.printCoverageThresholds,
    },
  };
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
    .then((config) => usePricingConfigStore.setState({ config: normalizePriceConfig(config) }))
    .catch(() => {
      // Keep the default — point-server unreachable or never synced.
    });

  subscribePricingEvents((config) =>
    usePricingConfigStore.setState({ config: normalizePriceConfig(config) }),
  );
}
