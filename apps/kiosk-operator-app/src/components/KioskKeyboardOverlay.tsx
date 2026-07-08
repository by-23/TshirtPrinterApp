import { useEffect, useRef, useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { useTranslation } from "react-i18next";
import { useKioskKeyboardStore } from "../lib/kioskKeyboardStore.js";
import { isKeyboardableElement, insertAtCursor, backspaceAtCursor } from "../lib/kioskKeyboardDom.js";
import { KEYBOARD_LAYOUTS, KEYBOARD_BUTTON_DISPLAY } from "./kioskKeyboardLayouts.js";

type LayoutName = "default" | "shift" | "numbers";

/**
 * Global on-screen keyboard for the customer-facing kiosk — mounted once in
 * `KioskShell.tsx` (never under `/operator/*`, which has a physical
 * keyboard). Tracks focus on any text `<input>`/`<textarea>` in the
 * document, including Fabric's own `hiddenTextarea` used while editing an
 * `IText` on the design canvas (see `kioskKeyboardDom.ts`).
 *
 * RU/EN only — `react-simple-keyboard` ships no KK/ZH layout, and building
 * one (especially a pinyin IME for ZH) is out of scope; those two languages
 * fall back to Windows' own touch keyboard, which pops up automatically on
 * a touchscreen when a text field gets focus.
 */
export function KioskKeyboardOverlay() {
  const { i18n } = useTranslation();
  const target = useKioskKeyboardStore((state) => state.target);
  const setTarget = useKioskKeyboardStore((state) => state.setTarget);
  const [layoutName, setLayoutName] = useState<LayoutName>("default");
  const panelRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  const language = i18n.language.startsWith("ru") ? "ru" : i18n.language.startsWith("en") ? "en" : null;

  useEffect(() => {
    function handleFocusIn(event: FocusEvent) {
      const el = event.target;
      if (el instanceof HTMLElement && isKeyboardableElement(el)) {
        if (blurTimerRef.current !== null) {
          window.clearTimeout(blurTimerRef.current);
          blurTimerRef.current = null;
        }
        setTarget(el);
      }
    }

    function handleFocusOut() {
      // Debounced: lets focus move directly from one text field to another
      // (e.g. tabbing between two inputs) without the keyboard flickering
      // closed-then-open. Our own key buttons never steal focus (see
      // `preventFocusSteal` below), so this only fires on a genuine blur —
      // tapping the canvas background, closing a popover, etc.
      blurTimerRef.current = window.setTimeout(() => {
        const active = document.activeElement;
        if (!isKeyboardableElement(active)) {
          setTarget(null);
          setLayoutName("default");
        }
      }, 80);
    }

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      if (blurTimerRef.current !== null) window.clearTimeout(blurTimerRef.current);
    };
  }, [setTarget]);

  // If the focused element gets unmounted (e.g. a popover tool closes)
  // while the keyboard is open, drop the stale reference.
  useEffect(() => {
    if (target && !document.contains(target)) {
      setTarget(null);
    }
  });

  if (!target || !language) return null;

  function withLiveTarget(action: (el: HTMLInputElement | HTMLTextAreaElement) => void) {
    if (!target || !document.contains(target)) return;
    action(target);
    target.focus();
  }

  function handleKeyPress(button: string) {
    if (button === "{shift}") {
      setLayoutName((current) => (current === "shift" ? "default" : "shift"));
      return;
    }
    if (button === "{numbers}") {
      setLayoutName((current) => (current === "numbers" ? "default" : "numbers"));
      return;
    }
    if (button === "{bksp}") {
      withLiveTarget(backspaceAtCursor);
      return;
    }
    if (button === "{enter}") {
      withLiveTarget((el) => insertAtCursor(el, "\n"));
      return;
    }
    if (button === "{space}") {
      withLiveTarget((el) => insertAtCursor(el, " "));
      return;
    }
    withLiveTarget((el) => insertAtCursor(el, button));
    // A "shifted" keyboard behaves like a physical one — types one
    // uppercase letter, then drops back to lowercase.
    if (layoutName === "shift") setLayoutName("default");
  }

  return (
    <div
      ref={panelRef}
      // Buttons are plain <button>/<div> elements from the library; without
      // this, tapping one would steal focus away from `target` before
      // `handleKeyPress` runs, breaking the caret position the insert/backspace
      // helpers rely on.
      onPointerDownCapture={(event) => event.preventDefault()}
      className="kiosk-keyboard fixed inset-x-0 bottom-0 z-[999] flex justify-center pb-[env(safe-area-inset-bottom)]"
    >
      <div className="w-full max-w-4xl rounded-t-3xl border border-ink-700 bg-ink-950/95 p-3 shadow-2xl backdrop-blur">
        <Keyboard
          layoutName={layoutName}
          layout={KEYBOARD_LAYOUTS[language]}
          display={KEYBOARD_BUTTON_DISPLAY}
          onKeyPress={handleKeyPress}
          theme="hg-theme-default kiosk-keyboard-theme"
          physicalKeyboardHighlight={false}
          preventMouseDownDefault
        />
      </div>
    </div>
  );
}
