import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type Canvas } from "fabric";
import { addImageFromUrl } from "../canvasImage.js";
import { blockBorderStyle, tileBorderStyle } from "../borderStyle.js";
import { syncPopularScrollElement } from "../popularScrollTheme.js";
import { useKioskImage } from "../../lib/kioskImages.js";
import { usePopularPrintSlides, type BannerSlide } from "../../lib/popularPrints.js";
import { editorThemeSection } from "../themeSections.js";

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

/**
 * Bottom "Популярные элементы" strip: same highest use-count designs as the
 * home "Популярные принты" banner (see `usePopularPrintSlides`).
 */
export function PopularElementsStrip({ canvas }: PopularElementsStripProps) {
  const { t } = useTranslation();
  const slides = usePopularPrintSlides();
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

  return (
    <section
      className="flex w-full min-w-0 flex-col"
      {...editorThemeSection("popular")}
      style={{
        ...blockBorderStyle("popular-block"),
        maxWidth: "100%",
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
      </div>
    </section>
  );
}
