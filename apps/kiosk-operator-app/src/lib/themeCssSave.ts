/** Dev-only endpoint (Vite plugin) that patches `src/index.css` :root tokens. */
export const THEME_SAVE_PATH = "/__kiosk/save-theme-defaults";

export type ThemeSaveState = "idle" | "saving" | "saved" | "error";

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

  async function flush(tokens: Record<string, string>) {
    if (Object.keys(tokens).length === 0) return;
    inFlight = true;
    setState("saving");
    try {
      await saveThemeTokensToCss(tokens);
      setState("saved");
      if (savedResetTimer) clearTimeout(savedResetTimer);
      savedResetTimer = setTimeout(() => setState("idle"), 1600);
    } catch {
      setState("error");
      if (savedResetTimer) clearTimeout(savedResetTimer);
      savedResetTimer = setTimeout(() => setState("idle"), 2800);
    } finally {
      inFlight = false;
      if (queuedWhileFlying && Object.keys(queuedWhileFlying).length > 0) {
        const next = queuedWhileFlying;
        queuedWhileFlying = null;
        void flush(next);
      }
    }
  }

  function enqueue(tokens: Record<string, string>) {
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
      return "Запись в CSS…";
    case "saved":
      return "Записано в index.css";
    case "error":
      return "Ошибка — только dev-сервер";
    default:
      return "Меняешь — сразу пишется в CSS";
  }
}
