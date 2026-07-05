import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { useEditorStore } from "../store.js";

export interface ObjectControlsProps {
  canvas: Canvas | null;
}

/**
 * Small floating circle buttons shown above the selected object
 * (`docs/ui-mockups/editor.png`: delete / flip-h / flip-v). Scale, rotation,
 * opacity and layer order live in `CanvasControlStrip` below the canvas.
 */
export function ObjectControls({ canvas }: ObjectControlsProps) {
  const { t } = useTranslation();
  const hasSelection = useEditorStore((state) => state.hasSelection);

  function withActiveObject(action: (active: NonNullable<ReturnType<Canvas["getActiveObject"]>>) => void) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    action(active);
    active.setCoords();
    canvas.requestRenderAll();
  }

  function handleDelete() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  if (!hasSelection) return null;

  return (
    <div className="flex items-center gap-2 rounded-full border border-ink-600 bg-ink-950/90 px-2 py-1.5 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={handleDelete}
        title={t("editor.toolbar.delete")}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white transition-transform hover:scale-110"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={() => withActiveObject((active) => active.set("flipX", !active.flipX))}
        title={t("editor.toolbar.flipHorizontal")}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-sm text-white transition-transform hover:scale-110 hover:bg-ink-700"
      >
        ⇋
      </button>
      <button
        type="button"
        onClick={() => withActiveObject((active) => active.set("flipY", !active.flipY))}
        title={t("editor.toolbar.flipVertical")}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-800 text-sm text-white transition-transform hover:scale-110 hover:bg-ink-700"
      >
        ⇅
      </button>
    </div>
  );
}
