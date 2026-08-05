import { useTranslation } from "react-i18next";
import { FabricText, type Canvas } from "fabric";
import { getDesignAreaSize } from "../selectionControlOverscan.js";
import { ALL_EMOJIS, EMOJI_FONT_FAMILY, EMOJI_FONT_SIZE } from "./emojis.js";

export interface EmojiPickerProps {
  canvas: Canvas | null;
}

/**
 * "Emoji" toolbar tool — curated offline set (replaces Giphy stickers).
 * Picking an emoji places a large non-editable `FabricText` on the canvas.
 */
export function EmojiPicker({ canvas }: EmojiPickerProps) {
  const { t } = useTranslation();

  function handlePick(emoji: string) {
    if (!canvas) return;
    const { width, height } = getDesignAreaSize(canvas);
    const text = new FabricText(emoji, {
      left: width / 2,
      top: height / 2,
      originX: "center",
      originY: "center",
      fontFamily: EMOJI_FONT_FAMILY,
      fontSize: EMOJI_FONT_SIZE,
      fill: "#000000",
      editable: false,
      textAlign: "center",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  }

  return (
    <div className="editor-tool-panel max-h-[70vh]">
      <h4 className="editor-tool-title">{t("editor.toolbar.emoji")}</h4>

      <div className="editor-tool-emoji-grid min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="grid w-full grid-cols-6 gap-1.5">
          {ALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handlePick(emoji)}
              aria-label={emoji}
              className="flex aspect-square min-w-0 items-center justify-center overflow-hidden rounded-xl bg-ink-800 text-6xl leading-none transition-transform hover:scale-105 hover:bg-ink-700"
              style={{ fontFamily: EMOJI_FONT_FAMILY }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
