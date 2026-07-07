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
  cornerSize: 14,
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
