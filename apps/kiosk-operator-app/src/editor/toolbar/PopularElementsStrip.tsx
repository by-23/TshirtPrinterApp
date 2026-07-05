import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { Plus } from "../../components/icons.js";
import { addImageFromUrl, placeImageCentered } from "../canvasImage.js";
import { blockBorderStyle } from "../borderStyle.js";
import { syncPopularScrollElement } from "../popularScrollTheme.js";
import { EDITOR_POPULAR_PRINTS, type PrintDefinition } from "../../lib/printCatalog.js";
import { popularPrintImageKey, useKioskImage } from "../../lib/kioskImages.js";

export interface PopularElementsStripProps {
  canvas: Canvas | null;
}

function PopularPrintTile({
  print,
  onAdd,
}: {
  print: PrintDefinition;
  onAdd: (url: string) => void;
}) {
  const previewUrl = useKioskImage(popularPrintImageKey(print.id)) || print.url;
  const tileStyle = {
    width: "var(--editor-popular-image-width)",
    height: "var(--editor-popular-image-height)",
    borderRadius: "var(--editor-popular-tile-radius)",
    backgroundColor: "var(--editor-popular-tile-bg)",
  } as const;

  return (
    <button
      type="button"
      aria-label={print.label}
      onClick={() => onAdd(previewUrl)}
      style={tileStyle}
      className="flex flex-shrink-0 items-center justify-center overflow-hidden transition-colors hover:brightness-125"
    >
      <img src={previewUrl} alt="" className="h-full w-full object-contain" />
    </button>
  );
}

/**
 * Bottom "Популярные элементы" strip: bundled prints from `src/assets/prints/`
 * plus an "Add your own" tile that opens the file picker.
 */
export function PopularElementsStrip({ canvas }: PopularElementsStripProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const themeRoot = scrollEl?.closest(".editor-theme-root");
    if (!scrollEl || !(themeRoot instanceof HTMLElement)) return;
    syncPopularScrollElement(scrollEl, themeRoot);
  }, []);

  function addPrint(url: string) {
    if (!canvas) return;
    void addImageFromUrl(canvas, url);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      void FabricImage.fromURL(dataUrl).then((image) => placeImageCentered(canvas, image));
    };
    reader.readAsDataURL(file);
  }

  return (
    <section
      className="flex w-full min-w-0 flex-col gap-3"
      style={{ ...blockBorderStyle("popular-block"), width: "100%" }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-200">
        {t("editor.popularElements")}
      </h3>
      <div
        ref={scrollRef}
        className="editor-popular-scroll flex"
        style={{ gap: "var(--editor-popular-image-gap)", overflowX: "hidden", overflowY: "hidden" }}
      >
        {EDITOR_POPULAR_PRINTS.map((print) => (
          <PopularPrintTile key={print.id} print={print} onAdd={addPrint} />
        ))}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: "var(--editor-popular-image-width)",
            height: "var(--editor-popular-image-height)",
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
