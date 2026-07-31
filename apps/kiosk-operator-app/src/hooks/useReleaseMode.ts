import { useSyncExternalStore } from "react";
import { isReleaseMode, subscribeReleaseMode } from "../lib/releaseMode.js";

/** Reactive release/native mode flag (shared via localStorage across windows). */
export function useReleaseMode(): boolean {
  return useSyncExternalStore(subscribeReleaseMode, isReleaseMode, () => false);
}
