import { FabricObject, type Canvas, type FabricObject as FabricObjectType } from "fabric";

export const SELECTION_BORDER_COLOR = "#00e5ff";
export const SELECTION_CORNER_COLOR = "#00e5ff";

const OBJECT_SELECTION_STYLE = {
  borderColor: SELECTION_BORDER_COLOR,
  cornerColor: SELECTION_CORNER_COLOR,
  cornerStrokeColor: "#ffffff",
  transparentCorners: false,
  borderScaleFactor: 2.5,
  borderOpacityWhenMoving: 1,
  // Kiosk is touch-first: always use the large touch hit targets, even when
  // a mouse drives the CSS-scaled KioskFrame in development.
  cornerSize: 28,
  touchCornerSize: 28,
} as const;

export function configureCanvasSelectionStyle(canvas?: Canvas) {
  Object.assign(FabricObject.ownDefaults, OBJECT_SELECTION_STYLE);

  if (!canvas) return;

  canvas.selectionColor = "rgba(0, 229, 255, 0.12)";
  canvas.selectionBorderColor = SELECTION_BORDER_COLOR;
  canvas.selectionLineWidth = 2.5;
}

export function applySelectionStyleToObject(object: FabricObjectType) {
  object.set({ ...OBJECT_SELECTION_STYLE });
}

export function applySelectionStyleToAllObjects(canvas: Canvas) {
  for (const object of canvas.getObjects()) {
    applySelectionStyleToObject(object);
  }
}

export const EDITOR_SELECTION_UI_SELECTOR = "[data-editor-selection-ui]";

/** Left-rail tool popovers and their portaled sub-panels (e.g. color picker). */
export const EDITOR_TOOL_UI_SELECTOR = "[data-editor-tool-ui]";

export function deselectCanvasSelection(canvas: Canvas | null): void {
  if (!canvas?.getActiveObject()) return;
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export function shouldDeselectCanvasOnPointerDown(
  target: EventTarget | null,
  printAreaElement: HTMLElement | null,
): boolean {
  if (!(target instanceof Node)) return false;
  if (printAreaElement?.contains(target)) return false;
  if (target instanceof Element && target.closest(EDITOR_SELECTION_UI_SELECTOR)) return false;
  return true;
}
