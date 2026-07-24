import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fires after `timeoutMs` without pointer/keyboard/wheel activity.
 * While `active`, listeners pause — the caller dismisses explicitly (e.g. tap
 * on the screensaver overlay) so video playback itself doesn't reset the idle.
 */
export function useKioskIdle(timeoutMs: number, enabled: boolean) {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    clearTimer();
    if (!enabled) return;
    timerRef.current = window.setTimeout(() => setActive(true), timeoutMs);
  }, [clearTimer, enabled, timeoutMs]);

  const dismiss = useCallback(() => {
    setActive(false);
    schedule();
  }, [schedule]);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      clearTimer();
      return;
    }

    // While the screensaver is up, ignore background activity — only `dismiss`
    // from the overlay should clear it (and restart the timer).
    if (active) return;

    const onActivity = () => schedule();
    const events = ["pointerdown", "keydown", "wheel"] as const;
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    schedule();

    return () => {
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
      clearTimer();
    };
  }, [enabled, active, schedule, clearTimer]);

  return { active, dismiss };
}
