import { create } from "zustand";
import type { PointConfigSnapshot } from "@tshirt/shared-types";
import { fetchPointConfig, subscribePointConfigEvents } from "./pointServer.js";

interface PointStatusState {
  config: PointConfigSnapshot | null;
}

/**
 * Cached point status/name/uploadMode (Этап 7, `sync:snapshot` pulled down
 * from central-relay). `config: null` means "not loaded yet" — the kiosk
 * gate (`KioskShell`) treats that the same as `"open"` so a slow/failed
 * initial fetch never blocks the whole kiosk (fail-open); once loaded, an
 * explicit `"closed"` blocks checkout via `ClosedScreen`.
 */
export const usePointStatusStore = create<PointStatusState>(() => ({
  config: null,
}));

let initialized = false;

/** Call once (e.g. from `KioskShell`) to fetch + subscribe to live status updates. Safe to call repeatedly. */
export function initPointStatus(): void {
  if (initialized) return;
  initialized = true;

  fetchPointConfig()
    .then((config) => usePointStatusStore.setState({ config }))
    .catch(() => {
      // point-server unreachable — stay fail-open (config stays null == open).
    });

  // Defer Socket.IO so the first kiosk paint isn't competing with WS handshake.
  // Fallback poll keeps closed-status reasonably fresh on weak Android.
  const connectRealtime = () => {
    subscribePointConfigEvents((config) => usePointStatusStore.setState({ config }));
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => connectRealtime(), { timeout: 4000 });
  } else {
    setTimeout(connectRealtime, 1500);
  }

  const POLL_MS = 60_000;
  window.setInterval(() => {
    void fetchPointConfig()
      .then((config) => usePointStatusStore.setState({ config }))
      .catch(() => undefined);
  }, POLL_MS);
}
