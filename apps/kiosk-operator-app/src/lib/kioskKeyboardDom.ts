import type { KeyboardableElement } from "./kioskKeyboardStore.js";

/**
 * Elements the on-screen keyboard should react to: normal text inputs plus
 * Fabric's `hiddenTextarea` — see the comment on `KioskKeyboardState.target`.
 * Excludes non-text `<input>` types (checkbox/range/color/...) so focusing
 * those elsewhere in the kiosk app never pops the keyboard unexpectedly.
 */
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "tel", "url", "password", undefined]);

export function isKeyboardableElement(el: Element | null): el is KeyboardableElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type);
  return false;
}

function nativeValueSetter(el: KeyboardableElement): (value: string) => void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  return (value: string) => {
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
  };
}

/**
 * Inserts `text` at the current caret position (replacing any selection),
 * then fires a real `input` event so both React's synthetic event system
 * (via the native-setter trick, needed for controlled inputs like the
 * gallery search box) and Fabric's own `hiddenTextarea` input listener
 * (`updateFromTextArea`, a plain `addEventListener("input", ...)`) pick up
 * the change the same way a physical keyboard would.
 */
export function insertAtCursor(el: KeyboardableElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const nextValue = el.value.slice(0, start) + text + el.value.slice(end);
  nativeValueSetter(el)(nextValue);
  const nextPos = start + text.length;
  el.setSelectionRange(nextPos, nextPos);
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
}

/** Deletes the selection, or one character before the caret when there's no selection. */
export function backspaceAtCursor(el: KeyboardableElement): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  let nextValue: string;
  let nextPos: number;
  if (start !== end) {
    nextValue = el.value.slice(0, start) + el.value.slice(end);
    nextPos = start;
  } else if (start > 0) {
    nextValue = el.value.slice(0, start - 1) + el.value.slice(start);
    nextPos = start - 1;
  } else {
    return;
  }
  nativeValueSetter(el)(nextValue);
  el.setSelectionRange(nextPos, nextPos);
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
}
