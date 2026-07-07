import sharp from "sharp";

export interface ImageProbe {
  hasTransparency: boolean;
  width: number;
  height: number;
}

/**
 * A downloaded PNG only counts as "actually transparent" if it carries an
 * alpha channel AND that channel varies (min < 255) — a flat, fully-opaque
 * alpha channel (e.g. a white background photo re-saved as RGBA) is not a
 * real cut-out, see docs/PLAN.md Этап 3 "Валидация и дедупликация".
 */
export async function probeImage(filePath: string): Promise<ImageProbe> {
  const image = sharp(filePath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (!metadata.hasAlpha) {
    return { hasTransparency: false, width, height };
  }

  const { channels } = await image.stats();
  const alphaChannel = channels[channels.length - 1];
  const hasTransparency = alphaChannel !== undefined && alphaChannel.min < 255;
  return { hasTransparency, width, height };
}
