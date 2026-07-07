import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { Plus } from "../../components/icons.js";
import { addImageFromUrl, placeImageCentered } from "../canvasImage.js";
import { blockBorderStyle, tileBorderStyle } from "../borderStyle.js";
import { syncPopularScrollElement } from "../popularScrollTheme.js";
import { useKioskImage } from "../../lib/kioskImages.js";
import { usePopularPrintSlides, type BannerSlide } from "../../lib/popularPrints.js";

export interface PopularElementsStripProps {
  canvas: Canvas | null;
}

function PopularPrintTile({
  slide,
  onAdd,
}: {
  slide: BannerSlide;
  onAdd: (url: string) => void;
}) {
  const overrideImage = useKioskImage(slide.overrideKey ?? "");
  const previewUrl = overrideImage || slide.imageUrl;

  return (
    <button
      type="button"
      aria-label={slide.label}
      onClick={() => onAdd(previewUrl)}
      style={tileBorderStyle("popular-tile")}
      className="editor-popular-tile flex flex-shrink-0 items-center justify-center transition-colors hover:brightness-125"
    >
      <span className="editor-popular-tile__image-wrap overflow-hidden">
        <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />
      </span>
    </button>
  );
}

function AddOwnTile({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...tileBorderStyle("popular-add"),
        color: "var(--editor-popular-add-text-color)",
      }}
      className="editor-popular-tile flex flex-shrink-0 flex-col items-center justify-center gap-1.5 transition-colors hover:brightness-125 hover:text-white"
    >
      <Plus
        aria-hidden
        strokeWidth={2.2}
        style={{
          width: "var(--editor-popular-add-icon-size)",
          height: "var(--editor-popular-add-icon-size)",
        }}
      />
      <span
        className="font-semibold uppercase leading-none"
        style={{ fontSize: "var(--editor-popular-add-font-size)" }}
      >
        {t("editor.addOwn")}
      </span>
    </button>
  );
}

/**
 * Bottom "Популярные элементы" strip: same highest use-count designs as the
 * home "Популярные принты" banner (see `usePopularPrintSlides`), plus an
 * "Add your own" tile that opens the file picker.
 */
export function PopularElementsStrip({ canvas }: PopularElementsStripProps) {
  const { t } = useTranslation();
  const slides = usePopularPrintSlides();
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
      className="flex w-full min-w-0 flex-col"
      style={{
        ...blockBorderStyle("popular-block"),
        width: "100%",
        gap: "var(--editor-popular-title-gap)",
      }}
    >
      <h3
        className="font-semibold uppercase tracking-wide"
        style={{
          fontSize: "var(--editor-popular-title-size)",
          color: "var(--editor-popular-title-color)",
        }}
      >
        {t("editor.popularElements")}
      </h3>
      <div
        ref={scrollRef}
        className="editor-popular-scroll flex w-full min-w-0"
        style={{
          gap: "var(--editor-popular-image-gap)",
          overflowX: "auto",
          overflowY: "visible",
        }}
      >
        {slides.map((slide) => (
          <PopularPrintTile key={slide.id} slide={slide} onAdd={addPrint} />
        ))}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <AddOwnTile onClick={() => inputRef.current?.click()} />
      </div>
    </section>
  );
}
