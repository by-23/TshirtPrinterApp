import { filters, type FabricImage } from "fabric";

// `fabric`'s root module doesn't re-export the `BaseFilter` type itself (only
// the concrete filter classes below) — derived from `FabricImage.filters`'s
// own element type instead of reaching into fabric's internal dist paths.
type FabricFilter = NonNullable<FabricImage["filters"]>[number];

/**
 * Client-side Fabric.js filters for the "Фильтры" tool (`FiltersTool.tsx`) —
 * instant, no round-trip to point-server. Deliberately separate from the
 * server-side `sharp` presets in `point-server/.../ai/local/engines/filters.ts`,
 * which power the ИИ-раздел's noir/sepia/popArt/pencilSketch *styles* instead.
 *
 * Fabric v7 ships no built-in `Sepia` filter (removed in the v6 filter
 * rewrite) — approximated here as grayscale + a warm `tint` blend, the
 * standard substitute recommended in Fabric's own filter examples.
 */
export interface ImageFilterState {
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  /** -1..1 */
  brightness: number;
  /** -1..1 */
  contrast: number;
  /** -1..1 */
  saturation: number;
  /** 0..1 */
  blur: number;
  /** 0 = off, otherwise block size in px (2..30) */
  pixelate: number;
}

export const DEFAULT_IMAGE_FILTER_STATE: ImageFilterState = {
  grayscale: false,
  sepia: false,
  invert: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
  pixelate: 0,
};

const SEPIA_TINT_COLOR = "#704214";
const SEPIA_TINT_ALPHA = 0.6;

export function buildImageFilters(state: ImageFilterState): FabricFilter[] {
  const list: FabricFilter[] = [];
  if (state.grayscale) list.push(new filters.Grayscale());
  if (state.sepia) {
    list.push(new filters.Grayscale());
    list.push(new filters.BlendColor({ color: SEPIA_TINT_COLOR, mode: "tint", alpha: SEPIA_TINT_ALPHA }));
  }
  if (state.invert) list.push(new filters.Invert());
  if (state.brightness !== 0) list.push(new filters.Brightness({ brightness: state.brightness }));
  if (state.contrast !== 0) list.push(new filters.Contrast({ contrast: state.contrast }));
  if (state.saturation !== 0) list.push(new filters.Saturation({ saturation: state.saturation }));
  if (state.blur > 0) list.push(new filters.Blur({ blur: state.blur }));
  if (state.pixelate > 0) list.push(new filters.Pixelate({ blocksize: state.pixelate }));
  return list;
}

/** Applies `state` to `image.filters` and re-runs the filter pipeline. */
export function applyImageFilters(image: FabricImage, state: ImageFilterState): void {
  image.filters = buildImageFilters(state);
  image.applyFilters();
}

export function isImageFilterStateEmpty(state: ImageFilterState): boolean {
  return (
    !state.grayscale &&
    !state.sepia &&
    !state.invert &&
    state.brightness === 0 &&
    state.contrast === 0 &&
    state.saturation === 0 &&
    state.blur === 0 &&
    state.pixelate === 0
  );
}
