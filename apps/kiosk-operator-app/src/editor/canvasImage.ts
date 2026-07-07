import { FabricImage, type Canvas } from "fabric";
import { applySelectionStyleToObject } from "./canvasSelectionStyle.js";

/** Fraction of the print-area canvas an inserted image may occupy on its longest side. */
export const MAX_IMAGE_FRACTION = 1;

/** Uniform scale that fits `imageWidth`×`imageHeight` inside `container` at `MAX_IMAGE_FRACTION`. */
export function computeCenteredImageScale(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): number {
  const maxWidth = containerWidth * MAX_IMAGE_FRACTION;
  const maxHeight = containerHeight * MAX_IMAGE_FRACTION;
  return Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
}

/** Centers `image` on `canvas`, scaled to fit within `MAX_IMAGE_FRACTION` (may upscale small assets). */
export function placeImageCentered(canvas: Canvas, image: FabricImage) {
  const scale = computeCenteredImageScale(
    image.width,
    image.height,
    canvas.getWidth(),
    canvas.getHeight(),
  );
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
