import { create } from "zustand";

export type KeyboardableElement = HTMLInputElement | HTMLTextAreaElement;

interface KioskKeyboardState {
  /**
   * Currently focused text field the on-screen keyboard should type into —
   * either a normal React-controlled `<input>`/`<textarea>` (e.g. the
   * gallery search box) or Fabric's own `hiddenTextarea` (a real `<textarea>`
   * it appends to the document while an `IText` is being edited, see
   * `editor/toolbar/TextTool.tsx`). Both are plain DOM elements, so one code
   * path in `KioskKeyboardOverlay` handles both.
   */
  target: KeyboardableElement | null;
  setTarget: (target: KeyboardableElement | null) => void;
}

export const useKioskKeyboardStore = create<KioskKeyboardState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}));
