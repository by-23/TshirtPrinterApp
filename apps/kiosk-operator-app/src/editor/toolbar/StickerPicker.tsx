import { useTranslation } from "react-i18next";
import { IText, type Canvas } from "fabric";
import { STICKERS } from "../types.js";

export interface StickerPickerProps {
  canvas: Canvas | null;
}

export function StickerPicker({ canvas }: StickerPickerProps) {
  const { t } = useTranslation();

  function addSticker(emoji: string) {
    if (!canvas) return;
    const sticker = new IText(emoji, {
      left: canvas.getWidth() / 2,
      top: canvas.getHeight() / 2,
      originX: "center",
      originY: "center",
      fontSize: 64,
      editable: false,
    });
    canvas.add(sticker);
    canvas.setActiveObject(sticker);
    canvas.requestRenderAll();
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.toolbar.stickers")}
      </h4>
      <div className="flex flex-wrap gap-1">
        {STICKERS.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            onClick={() => addSticker(sticker.emoji)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-800 text-2xl transition-colors hover:bg-ink-700"
          >
            {sticker.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
