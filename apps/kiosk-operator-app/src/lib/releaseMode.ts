const STORAGE_KEY = "tshirt.releaseMode";
const KIOSK_WINDOW_NAME = "tshirt-kiosk";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeReleaseMode(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** True when launched as a production/point display (no device bezel, no dev chrome). */
export function isReleaseMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("native") === "1" || params.get("release") === "1") return true;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

export function setReleaseMode(enabled: boolean): void {
  try {
    if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

/** Append `?native=1` so a URL always loads in release chrome. */
export function withNativeQuery(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("native", "1");
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return url;
  }
}

export function kioskReleaseUrl(): string {
  return withNativeQuery(`${window.location.origin}/kiosk`);
}

export function operatorReleaseUrl(): string {
  return withNativeQuery(`${window.location.origin}/operator`);
}

export { KIOSK_WINDOW_NAME };
