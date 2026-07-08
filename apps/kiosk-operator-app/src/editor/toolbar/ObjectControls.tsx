import { useEffect, useState } from "react";
import { FlipHorizontal, FlipVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { MOCKUP_DISPLAY_SCALE, type PrintAreaRect } from "../mockup/garmentShape.js";
import { useEditorStore } from "../store.js";
import { recordHistoryEntry } from "../history.js";

export interface ObjectControlsProps {
  canvas: Canvas | null;
  printArea: PrintAreaRect;
}

interface PanelPosition {
  left: number;
  top: number;
}

const PANEL_GAP_PX = 8;

function readPanelPosition(canvas: Canvas, printArea: PrintAreaRect): PanelPosition | null {
  const active = canvas.getActiveObject();
  if (!active) return null;

  active.setCoords();
  const rect = active.getBoundingRect();
  const offsetX = printArea.x * MOCKUP_DISPLAY_SCALE;
  const offsetY = printArea.y * MOCKUP_DISPLAY_SCALE;

  return {
    left: offsetX + rect.left + rect.width / 2,
    top: offsetY + rect.top,
  };
}

/**
 * Small floating buttons shown above the selected object
 * (`docs/ui-mockups/editor.png`: delete / flip-h / flip-v). Scale, rotation,
 * opacity and layer order live in `CanvasControlStrip` below the canvas.
 */
export function ObjectControls({ canvas, printArea }: ObjectControlsProps) {
  const { t } = useTranslation();
  const hasSelection = useEditorStore((state) => state.hasSelection);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  useEffect(() => {
    if (!canvas) {
      setPosition(null);
      return;
    }

    const refresh = () => {
      setPosition(readPanelPosition(canvas, printArea));
    };

    refresh();

    const events = [
      "selection:created",
      "selection:updated",
      "selection:cleared",
      "object:moving",
      "object:scaling",
      "object:rotating",
      "object:skewing",
      "object:modified",
    ] as const;

    events.forEach((event) => canvas.on(event, refresh));
    return () => {
      events.forEach((event) => canvas.off(event, refresh));
    };
  }, [canvas, printArea]);

  function withActiveObject(action: (active: NonNullable<ReturnType<Canvas["getActiveObject"]>>) => void) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    action(active);
    active.setCoords();
    canvas.requestRenderAll();
    setPosition(readPanelPosition(canvas, printArea));
    recordHistoryEntry(canvas);
  }

  function handleDelete() {
    if (!canvas) return;
    // `getActiveObject()` returns the temporary `ActiveSelection` wrapper when
    // multiple objects are selected, and that wrapper never lives in the
    // canvas's own object list — `canvas.remove(wrapper)` silently no-ops on
    // it. `getActiveObjects()` unwraps it back to the real objects so a
    // multi-selection actually gets deleted.
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;
    canvas.discardActiveObject();
    canvas.remove(...activeObjects);
    canvas.requestRenderAll();
    setPosition(null);
  }

  if (!hasSelection || !position) return null;

  const controlBtnStyle = {
    width: "var(--editor-objctrl-btn-width)",
    height: "var(--editor-objctrl-btn-height)",
    boxSizing: "border-box" as const,
  };

  const iconSize = "calc(var(--editor-objctrl-btn-width) * 0.45)";

  return (
    <div
      className="pointer-events-none absolute z-10"
      data-editor-selection-ui
      style={{
        left: position.left,
        top: position.top,
        transform: `translate(-50%, calc(-100% - ${PANEL_GAP_PX}px))`,
      }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1.5 bg-ink-950/90 px-1.5 py-1 shadow-lg backdrop-blur"
        style={{ borderRadius: "var(--editor-objctrl-bar-radius)" }}
      >
        <button
          type="button"
          onClick={handleDelete}
          title={t("editor.toolbar.delete")}
          style={{
            ...controlBtnStyle,
            backgroundColor: "var(--editor-objctrl-delete-bg)",
            borderRadius: "var(--editor-objctrl-bar-radius)",
          }}
          className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110"
        >
          <Trash2 aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => withActiveObject((active) => active.set("flipX", !active.flipX))}
          title={t("editor.toolbar.flipHorizontal")}
          style={{
            ...controlBtnStyle,
            backgroundColor: "var(--editor-objctrl-bg)",
            borderRadius: "var(--editor-objctrl-bar-radius)",
          }}
          className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110 hover:brightness-125"
        >
          <FlipHorizontal aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => withActiveObject((active) => active.set("flipY", !active.flipY))}
          title={t("editor.toolbar.flipVertical")}
          style={{
            ...controlBtnStyle,
            backgroundColor: "var(--editor-objctrl-bg)",
            borderRadius: "var(--editor-objctrl-bar-radius)",
          }}
          className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110 hover:brightness-125"
        >
          <FlipVertical aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
