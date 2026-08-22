import { Gradient, IText, Shadow, type FabricObject } from "fabric";
import "./imageSilhouetteStroke.js";

export type GradientDirection = "horizontal" | "vertical" | "diagonal";

export interface EffectsState {
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  /** Native `stroke`/`strokeWidth` for `IText`; for raster images a silhouette ring whose on-canvas thickness follows `strokeWidth`. */
  strokeEnabled: boolean;
  strokeColor: string;
  /** On-canvas thickness in scene pixels (images are converted to local units so scale-down doesn't hide the outline). */
  strokeWidth: number;
  opacity: number;
  /** Text-only — `fill` swapped for a `fabric.Gradient` while enabled. */
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
  gradientDirection: GradientDirection;
  /** Captured the moment gradient gets enabled so disabling it restores the previous solid color instead of guessing one. */
  plainFill: string;
}

export const DEFAULT_EFFECTS_STATE: EffectsState = {
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowBlur: 12,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  strokeEnabled: false,
  strokeColor: "#111111",
  strokeWidth: 8,
  opacity: 1,
  gradientEnabled: false,
  gradientFrom: "#ff2d95",
  gradientTo: "#00e5ff",
  gradientDirection: "horizontal",
  plainFill: "#ffffff",
};

export interface EffectsPreset {
  labelKey: string;
  state: Partial<EffectsState>;
}

/** One-tap combos — applied in full, but every value stays a normal editable field afterwards (no separate "preset mode"). */
export const EFFECTS_PRESETS: Record<"neon" | "vintage" | "metallic", EffectsPreset> = {
  neon: {
    labelKey: "editor.toolbar.effectsList.presetNeon",
    state: {
      shadowEnabled: true,
      shadowColor: "#00e5ff",
      shadowBlur: 25,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      strokeEnabled: true,
      strokeColor: "#00e5ff",
      strokeWidth: 1.5,
      gradientEnabled: false,
    },
  },
  vintage: {
    labelKey: "editor.toolbar.effectsList.presetVintage",
    state: {
      shadowEnabled: true,
      shadowColor: "#3a2a1a",
      shadowBlur: 6,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      strokeEnabled: false,
      gradientEnabled: true,
      gradientFrom: "#d9b48f",
      gradientTo: "#7a4a2b",
      gradientDirection: "vertical",
    },
  },
  metallic: {
    labelKey: "editor.toolbar.effectsList.presetMetallic",
    state: {
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowBlur: 8,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      strokeEnabled: false,
      gradientEnabled: true,
      gradientFrom: "#e8e8e8",
      gradientTo: "#8a8a8a",
      gradientDirection: "diagonal",
    },
  },
};

export const STROKE_WIDTH_SLIDER = { min: 1, max: 40, step: 1 } as const;

/** Converts a visible scene-pixel thickness into the object's local stroke units. */
export function visualStrokeToLocalWidth(object: FabricObject, visualWidth: number): number {
  const scale = Math.max(Math.abs(object.scaleX ?? 1), Math.abs(object.scaleY ?? 1), 0.05);
  return visualWidth / scale;
}

function gradientCoords(direction: GradientDirection, width: number, height: number) {
  if (direction === "horizontal") return { x1: 0, y1: 0, x2: width, y2: 0 };
  if (direction === "vertical") return { x1: 0, y1: 0, x2: 0, y2: height };
  return { x1: 0, y1: 0, x2: width, y2: height };
}

/** Applies every field of `state` to `object` — text gets native stroke + optional gradient fill; images get a silhouette ring via `stroke`/`strokeWidth`. */
export function applyEffects(object: FabricObject, state: EffectsState): void {
  object.set("opacity", state.opacity);

  const isText = object instanceof IText;

  if (isText) {
    object.set({
      stroke: state.strokeEnabled ? state.strokeColor : undefined,
      strokeWidth: state.strokeEnabled ? state.strokeWidth : 0,
    });

    if (state.gradientEnabled) {
      const width = object.width ?? 100;
      const height = object.height ?? 100;
      object.set(
        "fill",
        new Gradient({
          type: "linear",
          coords: gradientCoords(state.gradientDirection, width, height),
          colorStops: [
            { offset: 0, color: state.gradientFrom },
            { offset: 1, color: state.gradientTo },
          ],
        }),
      );
    } else {
      object.set("fill", state.plainFill);
    }
  } else if (state.strokeEnabled) {
    const localWidth = visualStrokeToLocalWidth(object, state.strokeWidth);
    object.set({
      stroke: state.strokeColor,
      strokeWidth: localWidth,
      padding: localWidth,
      objectCaching: false,
    });
  } else {
    object.set({
      stroke: undefined,
      strokeWidth: 0,
      padding: 0,
    });
  }

  if (state.shadowEnabled) {
    object.set("shadow", new Shadow({ color: state.shadowColor, blur: state.shadowBlur, offsetX: state.shadowOffsetX, offsetY: state.shadowOffsetY }));
  } else {
    object.set("shadow", null);
  }

  object.setCoords();
}
