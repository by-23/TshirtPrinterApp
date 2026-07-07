import type { CSSProperties } from "react";

/** Same mechanics as checkout `borderStyle.ts`, scoped to `--ai-qr-*` tokens. */
export function blockBorderStyle(prefix: string): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: `var(--ai-qr-${prefix}-border-width)`,
    borderColor: `color-mix(in srgb, var(--ai-qr-${prefix}-border-color) calc(var(--ai-qr-${prefix}-border-opacity) * 100%), transparent)`,
    borderRadius: `var(--ai-qr-${prefix}-radius)`,
    padding: `var(--ai-qr-${prefix}-padding)`,
    height: `var(--ai-qr-${prefix}-height, auto)`,
    width: `var(--ai-qr-${prefix}-width, 100%)`,
    boxSizing: "border-box",
    overflowX: "visible",
    overflowY: "visible",
    textAlign: `var(--ai-qr-${prefix}-content-align, start)` as CSSProperties["textAlign"],
  };
}

export function cardGradientStyle(prefix: string): CSSProperties {
  return {
    backgroundColor: "transparent",
    backgroundImage: `linear-gradient(var(--ai-qr-${prefix}-bg-direction), var(--ai-qr-${prefix}-bg-start), var(--ai-qr-${prefix}-bg-end))`,
  };
}

export function contentBoxStyle(prefix: string): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: `var(--ai-qr-${prefix}-border-width)`,
    borderColor: `color-mix(in srgb, var(--ai-qr-${prefix}-border-color) calc(var(--ai-qr-${prefix}-border-opacity) * 100%), transparent)`,
    borderRadius: `var(--ai-qr-${prefix}-radius)`,
    padding: `var(--ai-qr-${prefix}-padding-y) var(--ai-qr-${prefix}-padding-x)`,
    backgroundColor: `var(--ai-qr-${prefix}-bg)`,
    gap: `var(--ai-qr-${prefix}-gap)`,
  };
}

export function dividerStyle(prefix: string): CSSProperties {
  return {
    width: `var(--ai-qr-${prefix}-width)`,
    flexShrink: 0,
    alignSelf: "stretch",
    margin: `var(--ai-qr-${prefix}-inset-y) 0`,
    backgroundColor: `color-mix(in srgb, var(--ai-qr-${prefix}-color) calc(var(--ai-qr-${prefix}-opacity) * 100%), transparent)`,
  };
}
