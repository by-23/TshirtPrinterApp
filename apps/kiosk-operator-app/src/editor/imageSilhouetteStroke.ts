import { FabricImage, FabricObject } from "fabric";

type TintCache = {
  key: string;
  canvas: HTMLCanvasElement;
};

type FabricImageWithTintCache = FabricImage & {
  __silhouetteTint?: TintCache;
};

function hasSilhouetteStroke(image: FabricImage): boolean {
  return typeof image.stroke === "string" && image.stroke.length > 0 && (image.strokeWidth ?? 0) > 0;
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const imageLike = source as HTMLImageElement;
  const canvasLike = source as HTMLCanvasElement;
  return {
    width: imageLike.naturalWidth || canvasLike.width || 0,
    height: imageLike.naturalHeight || canvasLike.height || 0,
  };
}

/** Same source/dest rect as FabricImage._renderFill, with an extra local-space offset. */
function drawImageContent(
  ctx: CanvasRenderingContext2D,
  image: FabricImage,
  elementToDraw: CanvasImageSource,
  offsetX: number,
  offsetY: number,
) {
  const scaled = image as FabricImage & { _filterScalingX?: number; _filterScalingY?: number };
  const scaleX = scaled._filterScalingX || 1;
  const scaleY = scaled._filterScalingY || 1;
  const w = image.width;
  const h = image.height;
  const cropX = Math.max(image.cropX, 0);
  const cropY = Math.max(image.cropY, 0);
  const { width: elWidth, height: elHeight } = sourceSize(elementToDraw);
  const sX = cropX * scaleX;
  const sY = cropY * scaleY;
  const sW = Math.min(w * scaleX, elWidth - sX);
  const sH = Math.min(h * scaleY, elHeight - sY);
  const maxDestW = Math.min(w, elWidth / scaleX - cropX);
  const maxDestH = Math.min(h, elHeight / scaleY - cropY);
  if (sW <= 0 || sH <= 0 || maxDestW <= 0 || maxDestH <= 0) return;
  ctx.drawImage(elementToDraw, sX, sY, sW, sH, -w / 2 + offsetX, -h / 2 + offsetY, maxDestW, maxDestH);
}

function tintKey(image: FabricImage): string {
  const element = image.getElement();
  const { width, height } = element ? sourceSize(element) : { width: 0, height: 0 };
  return `${image.stroke}|${width}x${height}`;
}

function getTintedElement(image: FabricImageWithTintCache): HTMLCanvasElement | null {
  const element = image.getElement();
  const color = image.stroke;
  if (!element || typeof color !== "string") return null;

  const key = tintKey(image);
  const cached = image.__silhouetteTint;
  if (cached && cached.key === key && !image.dirty) return cached.canvas;

  const { width, height } = sourceSize(element);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(element, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  image.__silhouetteTint = { key, canvas };
  return canvas;
}

function paintSilhouetteRing(ctx: CanvasRenderingContext2D, image: FabricImageWithTintCache) {
  const tinted = getTintedElement(image);
  if (!tinted) return;
  const radius = image.strokeWidth;
  const moving = image.isMoving === true;
  const steps = moving ? 12 : Math.max(16, Math.min(48, Math.round(Math.PI * Math.max(radius, 1))));
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    drawImageContent(ctx, image, tinted, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
}

let installed = false;

/**
 * Image `stroke`/`strokeWidth` is a rectangular path in Fabric — we paint a
 * silhouette ring instead, so JSON snapshots (undo / checkout / DTF export)
 * keep working via the native stroke fields.
 */
export function installImageSilhouetteStroke(): void {
  if (installed) return;
  installed = true;

  const originalRenderFill = FabricImage.prototype._renderFill;
  const originalRenderStroke = FabricObject.prototype._renderStroke;

  FabricImage.prototype._renderStroke = function (this: FabricImage, ctx: CanvasRenderingContext2D) {
    if (hasSilhouetteStroke(this)) return;
    originalRenderStroke.call(this, ctx);
  };

  FabricImage.prototype._renderFill = function (this: FabricImage, ctx: CanvasRenderingContext2D) {
    if (hasSilhouetteStroke(this)) {
      paintSilhouetteRing(ctx, this as FabricImageWithTintCache);
    }
    originalRenderFill.call(this, ctx);
  };
}

installImageSilhouetteStroke();
