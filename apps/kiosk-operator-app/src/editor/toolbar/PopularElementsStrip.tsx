import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { IText, FabricImage, type Canvas } from "fabric";
import { Plus } from "../../components/icons.js";
import { STICKERS } from "../types.js";
import { bottomStripLayoutStyle } from "../borderStyle.js";

export interface PopularElementsStripProps {
  canvas: Canvas | null;
}

const MAX_IMAGE_FRACTION = 0.85;
const POPULAR_COUNT = 4;

/**
 * Bottom "Популярные элементы" strip from `docs/ui-mockups/editor.png`:
 * quick-access shortcuts for frequently used stickers plus an
 * "Add your own" tile that opens the file picker directly.
 */
export function PopularElementsStrip({ canvas }: PopularElementsStripProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const popularStickers = STICKERS.slice(0, POPULAR_COUNT);

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

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      void FabricImage.fromURL(dataUrl).then((image) => {
        const maxWidth = canvas.getWidth() * MAX_IMAGE_FRACTION;
        const maxHeight = canvas.getHeight() * MAX_IMAGE_FRACTION;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        image.set({
          left: canvas.getWidth() / 2,
          top: canvas.getHeight() / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.requestRenderAll();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="flex flex-col gap-3" style={bottomStripLayoutStyle("popular-block")}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.popularElements")}
      </h3>
      <div
        className="flex pb-1"
        style={{ gap: "var(--editor-popular-tile-gap)", overflowX: "auto", overflowY: "visible" }}
      >
        {popularStickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            onClick={() => addSticker(sticker.emoji)}
            style={{
              width: "var(--editor-popular-tile-width)",
              height: "var(--editor-popular-tile-height)",
              borderRadius: "var(--editor-popular-tile-radius)",
              backgroundColor: "var(--editor-popular-tile-bg)",
              fontSize: "var(--editor-popular-emoji-size)",
            }}
            className="flex flex-shrink-0 items-center justify-center overflow-hidden leading-none transition-colors hover:brightness-125"
          >
            {sticker.emoji}
          </button>
        ))}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: "var(--editor-popular-tile-width)",
            height: "var(--editor-popular-tile-height)",
            borderRadius: "var(--editor-popular-tile-radius)",
          }}
          className="flex flex-shrink-0 flex-col items-center justify-center gap-1.5 text-ink-200 transition-colors hover:text-white"
        >
          <Plus aria-hidden className="h-8 w-8" strokeWidth={2.2} />
          <span className="text-xs font-semibold uppercase leading-none">{t("editor.addOwn")}</span>
        </button>
      </div>
    </section>
  );
}
