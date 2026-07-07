/**
 * Drop PNG / JPG / WebP / SVG files into `src/assets/prints/`.
 * Vite picks them up on refresh — no manual registration.
 *
 * Naming:
 * - `01-cool-bear.png` → id `01-cool-bear`, sorted by filename
 * - optional numeric prefix controls carousel order
 */

const PRINT_IMAGE_GLOB = import.meta.glob("../assets/prints/*.{png,jpg,jpeg,webp,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const LIKES_PLACEHOLDERS = ["1.2k", "987", "1.5k", "2.3k", "1.1k", "860", "1.4k", "742"] as const;

export interface PrintDefinition {
  id: string;
  url: string;
  label: string;
  likes: string;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function printIdFromPath(path: string): string {
  return basename(path).replace(/\.(png|jpe?g|webp|svg)$/i, "");
}

function formatLabel(id: string): string {
  return id
    .replace(/^\d+[-_]/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function buildCatalog(): PrintDefinition[] {
  return Object.entries(PRINT_IMAGE_GLOB)
    .map(([path, url]) => ({ path, id: printIdFromPath(path), url }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map((entry, index) => ({
      id: entry.id,
      url: entry.url,
      label: formatLabel(entry.id) || entry.id,
      likes: LIKES_PLACEHOLDERS[index % LIKES_PLACEHOLDERS.length] ?? "1k",
    }));
}

/** All bundled print assets from `src/assets/prints/`, sorted by filename. */
export const PRINT_CATALOG: PrintDefinition[] = buildCatalog();

export function printImageKey(id: string): string {
  return `print-${id}`;
}

export function getPrintById(id: string): PrintDefinition | undefined {
  return PRINT_CATALOG.find((print) => print.id === id);
}

export function getPrintAssetUrl(id: string): string | undefined {
  return getPrintById(id)?.url;
}
