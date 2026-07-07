import { FabricImage, type Canvas } from "fabric";
import { applySelectionStyleToObject } from "./canvasSelectionStyle.js";

/** Fraction of the print-area canvas an inserted image may occupy on its longest side. */
export const MAX_IMAGE_FRACTION = 0.85;

/** Centers `image` on `canvas`, scaled down (never up) to fit within MAX_IMAGE_FRACTION. */
export function placeImageCentered(canvas: Canvas, image: FabricImage) {
  const maxWidth = canvas.getWidth() * MAX_IMAGE_FRACTION;
  const maxHeight = canvas.getHeight() * MAX_IMAGE_FRACTION;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  image.set({
    left: canvas.getWidth() / 2,
    top: canvas.getHeight() / 2,
    originX: "center",
    originY: "center",
    scaleX: scale,
    scaleY: scale,
  });
  applySelectionStyleToObject(image);
  canvas.add(image);
  canvas.setActiveObject(image);
  canvas.requestRenderAll();
}

/** Loads a bundled or override print URL and places it on the canvas. */
export async function addImageFromUrl(canvas: Canvas, url: string): Promise<void> {
  const image = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
  placeImageCentered(canvas, image);
}
