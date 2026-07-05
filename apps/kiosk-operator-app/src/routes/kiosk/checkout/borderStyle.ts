import type { CSSProperties } from "react";

/**
 * Same mechanics as `editor/borderStyle.ts`, scoped to the checkout screen's
 * own `--checkout-*` tokens so `CheckoutThemePanel` can retune it
 * independently from the editor.
 */
export function blockBorderStyle(prefix: string): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: `var(--checkout-${prefix}-border-width)`,
    borderColor: `color-mix(in srgb, var(--checkout-${prefix}-border-color) calc(var(--checkout-${prefix}-border-opacity) * 100%), transparent)`,
    borderRadius: `var(--checkout-${prefix}-radius)`,
    padding: `var(--checkout-${prefix}-padding)`,
    height: `var(--checkout-${prefix}-height, auto)`,
    width: `var(--checkout-${prefix}-width, 100%)`,
    boxSizing: "border-box",
    overflowX: "visible",
    overflowY: "visible",
    textAlign: `var(--checkout-${prefix}-content-align, start)` as CSSProperties["textAlign"],
  };
}

export function blockContentRowStyle(prefix: string): CSSProperties {
  return {
    justifyContent: `var(--checkout-${prefix}-content-align, start)`,
  };
}

export function dividerStyle(prefix: string, orientation: "horizontal" | "vertical" = "horizontal"): CSSProperties {
  const color = `color-mix(in srgb, var(--checkout-${prefix}-divider-color) calc(var(--checkout-${prefix}-divider-opacity) * 100%), transparent)`;
  return orientation === "horizontal"
    ? { width: "100%", height: `var(--checkout-${prefix}-divider-width)`, backgroundColor: color, flexShrink: 0 }
    : { width: `var(--checkout-${prefix}-divider-width)`, height: "100%", backgroundColor: color, flexShrink: 0 };
}

/** Gradient fill for payment cards — reads stop colors from the element cascade (not a derived var). */
export function cardGradientStyle(prefix: string): CSSProperties {
  return {
    backgroundColor: "transparent",
    backgroundImage: `linear-gradient(var(--checkout-${prefix}-bg-direction), var(--checkout-${prefix}-bg-start), var(--checkout-${prefix}-bg-end))`,
  };
}

/** Inner bordered box (order number, payment timer, etc.). */
export function contentBoxStyle(prefix: string): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: `var(--checkout-${prefix}-border-width)`,
    borderColor: `color-mix(in srgb, var(--checkout-${prefix}-border-color) calc(var(--checkout-${prefix}-border-opacity) * 100%), transparent)`,
    borderRadius: `var(--checkout-${prefix}-radius)`,
    padding: `var(--checkout-${prefix}-padding-y) var(--checkout-${prefix}-padding-x)`,
    backgroundColor: `var(--checkout-${prefix}-bg)`,
    gap: `var(--checkout-${prefix}-gap)`,
  };
}
