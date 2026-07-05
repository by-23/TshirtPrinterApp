import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { TouchButton } from "@tshirt/ui-kit";
import { useEditorStore } from "../store.js";

export interface ObjectControlsProps {
  canvas: Canvas | null;
}

const SCALE_STEP = 1.15;
const ROTATE_STEP = 15;

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

  const controls: Array<{ id: string; label: string; onClick: () => void }> = [
    {
      id: "flipH",
      label: t("editor.toolbar.flipHorizontal"),
      onClick: () => withActiveObject((active) => active.set("flipX", !active.flipX)),
    },
    {
      id: "flipV",
      label: t("editor.toolbar.flipVertical"),
      onClick: () => withActiveObject((active) => active.set("flipY", !active.flipY)),
    },
    {
      id: "scaleUp",
      label: t("editor.toolbar.scaleUp"),
      onClick: () =>
        withActiveObject((active) =>
          active.set({ scaleX: active.scaleX * SCALE_STEP, scaleY: active.scaleY * SCALE_STEP }),
        ),
    },
    {
      id: "scaleDown",
      label: t("editor.toolbar.scaleDown"),
      onClick: () =>
        withActiveObject((active) =>
          active.set({ scaleX: active.scaleX / SCALE_STEP, scaleY: active.scaleY / SCALE_STEP }),
        ),
    },
    {
      id: "rotateLeft",
      label: t("editor.toolbar.rotateLeft"),
      onClick: () => withActiveObject((active) => active.set("angle", (active.angle ?? 0) - ROTATE_STEP)),
    },
    {
      id: "rotateRight",
      label: t("editor.toolbar.rotateRight"),
      onClick: () => withActiveObject((active) => active.set("angle", (active.angle ?? 0) + ROTATE_STEP)),
    },
    {
      id: "bringForward",
      label: t("editor.toolbar.bringForward"),
      onClick: () => {
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.bringObjectForward(active);
        canvas.requestRenderAll();
      },
    },
    {
      id: "sendBackward",
      label: t("editor.toolbar.sendBackward"),
      onClick: () => {
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.sendObjectBackwards(active);
        canvas.requestRenderAll();
      },
    },
  ];

  function handleDelete() {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {controls.map((control) => (
        <TouchButton
          key={control.id}
          onClick={control.onClick}
          disabled={!hasSelection}
          className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {control.label}
        </TouchButton>
      ))}
      <TouchButton
        onClick={handleDelete}
        disabled={!hasSelection}
        className="rounded-full bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t("editor.toolbar.delete")}
      </TouchButton>
    </div>
  );
}
