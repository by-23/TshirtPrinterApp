import path from "node:path";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { FontFormat } from "@tshirt/shared-types";

const DATA_ROOT = path.resolve("data");
const FONTS_DIR = path.join(DATA_ROOT, "fonts");
const FONTS_TMP_DIR = path.join(DATA_ROOT, "fonts-tmp");

const EXT_BY_FORMAT: Record<FontFormat, string> = {
  truetype: ".ttf",
  opentype: ".otf",
  woff: ".woff",
  woff2: ".woff2",
};

export async function ensureFontsDir(): Promise<string> {
  await mkdir(FONTS_DIR, { recursive: true });
  return FONTS_DIR;
}

export async function writeTempFontUpload(buffer: Buffer, format: FontFormat): Promise<string> {
  await mkdir(FONTS_TMP_DIR, { recursive: true });
  const tempPath = path.join(FONTS_TMP_DIR, `${randomUUID()}${EXT_BY_FORMAT[format]}`);
  await writeFile(tempPath, buffer);
  return tempPath;
}

export async function deleteTempFontUpload(tempFilePath: string): Promise<void> {
  await rm(tempFilePath, { force: true });
}

export async function storeFontFile(tempFilePath: string, format: FontFormat): Promise<string> {
  const dir = await ensureFontsDir();
  const destination = path.join(dir, `${randomUUID()}${EXT_BY_FORMAT[format]}`);
  await rename(tempFilePath, destination);
  return destination;
}

export async function deleteFontFile(storagePath: string): Promise<void> {
  try {
    await rm(storagePath, { force: true });
  } catch {
    // fail-open — DB row is source of truth
  }
}

export function detectFontFormat(filename: string, mimeType: string | undefined): FontFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ttf") || mimeType === "font/ttf" || mimeType === "application/x-font-ttf") {
    return "truetype";
  }
  if (lower.endsWith(".otf") || mimeType === "font/otf" || mimeType === "application/x-font-otf") {
    return "opentype";
  }
  if (lower.endsWith(".woff2") || mimeType === "font/woff2") {
    return "woff2";
  }
  if (lower.endsWith(".woff") || mimeType === "font/woff") {
    return "woff";
  }
  return null;
}

export function contentTypeForFormat(format: FontFormat): string {
  switch (format) {
    case "truetype":
      return "font/ttf";
    case "opentype":
      return "font/otf";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
  }
}
