import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { FontFormat } from "@tshirt/shared-types";
import { ensureDataDir } from "../../lib/dataDir.js";

const PUBLIC_FONTS_PREFIX = "/files/fonts/";

const EXT_BY_FORMAT: Record<FontFormat, string> = {
  truetype: ".ttf",
  opentype: ".otf",
  woff: ".woff",
  woff2: ".woff2",
};

function fontsDir(): string {
  return path.join(ensureDataDir(), "fonts");
}

export function publicFontUrl(fontId: string, format: FontFormat): string {
  return `${PUBLIC_FONTS_PREFIX}${fontId}${EXT_BY_FORMAT[format]}`;
}

export async function writeFontFile(fontId: string, format: FontFormat, data: Buffer): Promise<string> {
  const dir = fontsDir();
  await mkdir(dir, { recursive: true });
  const filename = `${fontId}${EXT_BY_FORMAT[format]}`;
  await writeFile(path.join(dir, filename), data);
  return publicFontUrl(fontId, format);
}

export async function deleteFontFile(localFileUrl: string | null | undefined): Promise<void> {
  if (!localFileUrl?.startsWith(PUBLIC_FONTS_PREFIX)) return;
  const filename = localFileUrl.slice(PUBLIC_FONTS_PREFIX.length);
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) return;
  try {
    await rm(path.join(fontsDir(), filename), { force: true });
  } catch {
    // fail-open
  }
}
