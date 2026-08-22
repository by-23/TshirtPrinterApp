/** Dev-only endpoint (Vite plugin) that patches `src/index.css` :root tokens. */
export const THEME_SAVE_PATH = "/__kiosk/save-theme-defaults";

export type ThemeSaveState = "idle" | "saving" | "saved" | "error";

/** Survives refresh even when the Vite CSS writer is unavailable (point-server / dist). */
const RUNTIME_STORAGE_KEY = "tshirt.themeRuntimeOverrides";

/** Legacy keys from when theme panels staged overrides in localStorage. */
export const THEME_OVERRIDE_STORAGE_KEYS = [
  "kiosk-theme-overrides",
  "kiosk-editor-theme-overrides-v2",
  "kiosk-gallery-theme-overrides-v1",
  "kiosk-checkout-theme-overrides-v1",
  "kiosk-operator-theme-overrides-v1",
  "kiosk-ai-theme-overrides-v4",
  "kiosk-ai-source-theme-overrides-v1",
] as const;

export function clearThemeOverrideStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of THEME_OVERRIDE_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function readThemeRuntimeOverrides(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RUNTIME_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith("--") && typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeThemeRuntimeOverrides(patch: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readThemeRuntimeOverrides(), ...patch };
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}

export function removeThemeRuntimeOverrides(keys: string[]): void {
  if (typeof window === "undefined" || keys.length === 0) return;
  try {
    const next = readThemeRuntimeOverrides();
    for (const key of keys) delete next[key];
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Apply saved tokens onto `:root` so a refresh keeps the last design-panel edits. */
export function applyThemeRuntimeOverrides(tokens?: Record<string, string>): void {
  if (typeof document === "undefined") return;
  const patch = tokens ?? readThemeRuntimeOverrides();
  for (const [key, value] of Object.entries(patch)) {
    document.documentElement.style.setProperty(key, value);
  }
}

export function overlayThemeRuntimeOverrides(
  values: Record<string, string>,
  tokens: Array<{ key: string; type: string; unit?: string }>,
): Record<string, string> {
  const stored = readThemeRuntimeOverrides();
  const next = { ...values };
  for (const token of tokens) {
    const raw = stored[token.key];
    if (typeof raw !== "string" || raw === "") continue;
    next[token.key] =
      token.type === "range" && token.unit && raw.endsWith(token.unit)
        ? raw.slice(0, -token.unit.length)
        : raw;
  }
  return next;
}

export async function saveThemeTokensToCss(tokens: Record<string, string>): Promise<void> {
  const response = await fetch(THEME_SAVE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokens }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
}

/**
 * Debounced writer. Pending patches are merged by key so a slider drag only
 * touches the tokens that actually changed — never a full dump of computed styles.
 *
 * Runtime overlay is written synchronously to localStorage so a refresh never
 * loses values when `/__kiosk/save-theme-defaults` is missing (point-server).
 */
export function createThemeCssSaver(options?: {
  debounceMs?: number;
  onState?: (state: ThemeSaveState) => void;
}) {
  const debounceMs = options?.debounceMs ?? 450;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Record<string, string> = {};
  let savedResetTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let queuedWhileFlying: Record<string, string> | null = null;

  function setState(state: ThemeSaveState) {
    options?.onState?.(state);
  }

  function persist(tokens: Record<string, string>) {
    writeThemeRuntimeOverrides(tokens);
    applyThemeRuntimeOverrides(tokens);
  }

  async function flush(tokens: Record<string, string>) {
    if (Object.keys(tokens).length === 0) return;
    inFlight = true;
    setState("saving");
    try {
      await saveThemeTokensToCss(tokens);
    } catch {
      // Point-server / production has no Vite writer. Runtime overlay already persisted.
    }
    setState("saved");
    if (savedResetTimer) clearTimeout(savedResetTimer);
    savedResetTimer = setTimeout(() => setState("idle"), 1600);
    inFlight = false;
    if (queuedWhileFlying && Object.keys(queuedWhileFlying).length > 0) {
      const next = queuedWhileFlying;
      queuedWhileFlying = null;
      void flush(next);
    }
  }

  function enqueue(tokens: Record<string, string>) {
    persist(tokens);
    if (inFlight) {
      queuedWhileFlying = { ...(queuedWhileFlying || {}), ...tokens };
      return;
    }
    pending = { ...pending, ...tokens };
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const next = pending;
      pending = {};
      void flush(next);
    }, debounceMs);
  }

  return {
    /** Patch one or more already-formatted CSS values (e.g. `{ "--x": "12px" }`). */
    schedule(tokens: Record<string, string>) {
      enqueue(tokens);
    },
    scheduleOne(key: string, cssValue: string) {
      enqueue({ [key]: cssValue });
    },
    saveNow(tokens: Record<string, string>) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const merged = { ...pending, ...tokens };
      pending = {};
      return flush(merged);
    },
    forget(keys: string[]) {
      removeThemeRuntimeOverrides(keys);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      if (savedResetTimer) clearTimeout(savedResetTimer);
      timer = null;
      pending = {};
      queuedWhileFlying = null;
    },
  };
}

export function themeSaveStatusLabel(state: ThemeSaveState): string {
  switch (state) {
    case "saving":
      return "Сохранение…";
    case "saved":
      return "Сохранено";
    case "error":
      return "Не удалось сохранить";
    default:
      return "Сохраняется сразу — не слетит после обновления";
  }
}
