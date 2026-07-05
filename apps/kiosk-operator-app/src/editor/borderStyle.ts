import type { CSSProperties } from "react";

/**
 * Border + rounding + padding for a page-level "block" wrapper (e.g. the
 * color/size/material sections, the price block, the tips strip), driven
 * entirely by `--editor-<prefix>-border-*` / `-radius` / `-padding` custom
 * properties so `EditorThemePanel` can retune it live. Opacity is folded
 * into the border color via `color-mix` so panel changes stay purely
 * CSS-variable driven — no React re-render needed to see them take effect.
 */
export function blockBorderStyle(prefix: string): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: `var(--editor-${prefix}-border-width)`,
    borderColor: `color-mix(in srgb, var(--editor-${prefix}-border-color) calc(var(--editor-${prefix}-border-opacity) * 100%), transparent)`,
    borderRadius: `var(--editor-${prefix}-radius)`,
    padding: `var(--editor-${prefix}-padding)`,
    height: `var(--editor-${prefix}-height, auto)`,
    width: `var(--editor-${prefix}-width, 100%)`,
    boxSizing: "border-box",
    overflowX: "visible",
    overflowY: "visible",
  };
}

/** Keeps a bottom strip from stretching across the full editor width when width is fit-content. */
export function bottomStripLayoutStyle(prefix: string): CSSProperties {
  return {
    ...blockBorderStyle(prefix),
    maxWidth: "100%",
    alignSelf: "flex-start",
    overflow: "visible",
  };
}

/** Thin rule between elements inside a block, using the same opacity trick as `blockBorderStyle`. */
export function dividerStyle(prefix: string, orientation: "horizontal" | "vertical" = "horizontal"): CSSProperties {
  const color = `color-mix(in srgb, var(--editor-${prefix}-divider-color) calc(var(--editor-${prefix}-divider-opacity) * 100%), transparent)`;
  return orientation === "horizontal"
    ? { width: "100%", height: `var(--editor-${prefix}-divider-width)`, backgroundColor: color, flexShrink: 0 }
    : { width: `var(--editor-${prefix}-divider-width)`, height: "100%", backgroundColor: color, flexShrink: 0 };
}
