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

  const controlBtnStyle = {
    width: "var(--editor-objctrl-btn-width)",
    height: "var(--editor-objctrl-btn-height)",
  };

  return (
    <div
      className="flex items-center gap-2 bg-ink-950/90 px-2 py-1.5 shadow-lg backdrop-blur"
      style={{ borderRadius: "var(--editor-objctrl-bar-radius)" }}
    >
      <button
        type="button"
        onClick={handleDelete}
        title={t("editor.toolbar.delete")}
        style={{ ...controlBtnStyle, backgroundColor: "var(--editor-objctrl-delete-bg)", borderRadius: "var(--editor-objctrl-bar-radius)" }}
        className="flex items-center justify-center text-sm font-bold text-white transition-transform hover:scale-110"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={() => withActiveObject((active) => active.set("flipX", !active.flipX))}
        title={t("editor.toolbar.flipHorizontal")}
        style={{ ...controlBtnStyle, backgroundColor: "var(--editor-objctrl-bg)", borderRadius: "var(--editor-objctrl-bar-radius)" }}
        className="flex items-center justify-center text-sm text-white transition-transform hover:scale-110 hover:brightness-125"
      >
        ⇋
      </button>
      <button
        type="button"
        onClick={() => withActiveObject((active) => active.set("flipY", !active.flipY))}
        title={t("editor.toolbar.flipVertical")}
        style={{ ...controlBtnStyle, backgroundColor: "var(--editor-objctrl-bg)", borderRadius: "var(--editor-objctrl-bar-radius)" }}
        className="flex items-center justify-center text-sm text-white transition-transform hover:scale-110 hover:brightness-125"
      >
        ⇅
      </button>
    </div>
  );
}
