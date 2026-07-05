import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { designCategorySchema } from "@tshirt/shared-types";
import { fetchDesign } from "../../lib/pointServer.js";
import { useEditorStore } from "../../editor/store.js";
import { placeImageCentered } from "../../editor/canvasImage.js";
import { FabricCanvas } from "../../editor/FabricCanvas.js";
import { GarmentPicker } from "../../editor/GarmentPicker.js";
import { PrintSideToggle } from "../../editor/PrintSideToggle.js";
import { PriceAndPrint } from "../../editor/PriceAndPrint.js";
import { ToolRail } from "../../editor/toolbar/ToolRail.js";
import { ObjectControls } from "../../editor/toolbar/ObjectControls.js";
import { CanvasControlStrip } from "../../editor/toolbar/CanvasControlStrip.js";
import { PopularElementsStrip } from "../../editor/toolbar/PopularElementsStrip.js";
import { TipsBar } from "../../editor/toolbar/TipsBar.js";
import { LanguageSwitcher } from "../../components/LanguageSwitcher.js";
import { ArrowLeft } from "../../components/icons.js";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";
import { blockBorderStyle, dividerStyle } from "../../editor/borderStyle.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  PRINT_AREAS,
} from "../../editor/mockup/index.js";

export function Editor() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const garmentType = useEditorStore((state) => state.garmentType);
  const side = useEditorStore((state) => state.side);
  const color = useEditorStore((state) => state.color);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [showNextNotice, setShowNextNotice] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const appliedDesignIdRef = useRef<string | null>(null);

  const categoryParam = designCategorySchema.safeParse(searchParams.get("category"));
  const categoryLabel = categoryParam.success ? t(CATEGORY_LABEL_KEYS[categoryParam.data]) : null;
  const designId = searchParams.get("designId");

  // Preload the design picked in the category gallery (Stage 3) onto the
  // canvas once it's ready. Guarded by a ref (not just the effect deps) so a
  // canvas remount (e.g. after leaving/returning to the editor) doesn't
  // silently re-run for the same design twice.
  useEffect(() => {
    if (!canvas || !designId || appliedDesignIdRef.current === designId) return;
    appliedDesignIdRef.current = designId;

    let cancelled = false;
    fetchDesign(designId)
      .then((design) => {
        if (cancelled || !design.imageUrl) return;
        return FabricImage.fromURL(design.imageUrl).then((image) => {
          if (cancelled) return;
          placeImageCentered(canvas, image);
        });
      })
      .catch(() => {
        // point-server unreachable or design missing — leave the canvas blank.
      });

    return () => {
      cancelled = true;
    };
  }, [canvas, designId]);

  const printArea = PRINT_AREAS[garmentType][side];
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }

  return (
    <div
      ref={containerRef}
      className="editor-theme-root flex h-full w-full flex-col overflow-y-auto px-4 py-8 text-white"
      style={{ backgroundColor: "var(--editor-page-bg)", gap: "var(--editor-page-section-gap)" }}
    >
      <header className="relative flex items-center justify-between gap-4">
        <Link
          to="/kiosk"
          aria-label={t("common.back")}
          className="flex flex-shrink-0 items-center justify-center gap-2 px-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:brightness-125"
          style={{
            width: "var(--editor-back-btn-width)",
            height: "var(--editor-back-btn-height)",
            borderRadius: "var(--editor-back-btn-radius)",
            backgroundColor: "var(--editor-back-btn-bg)",
            borderStyle: "solid",
            borderWidth: "var(--editor-back-btn-border-width)",
            borderColor:
              "color-mix(in srgb, var(--editor-back-btn-border-color) calc(var(--editor-back-btn-border-opacity) * 100%), transparent)",
          }}
        >
          <ArrowLeft aria-hidden className="h-5 w-5 flex-shrink-0" strokeWidth={2.6} />
          <span>{t("common.back")}</span>
        </Link>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <h1
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: "var(--editor-header-title-size)", color: "var(--editor-header-title-color)" }}
          >
            {t("editor.title")}
          </h1>
          {categoryLabel && (
            <p
              className="font-semibold uppercase tracking-wide"
              style={{ fontSize: "var(--editor-header-category-size)", color: "var(--editor-header-category-color)" }}
            >
              {categoryLabel}
            </p>
          )}
        </div>
        <LanguageSwitcher editor />
      </header>

      <div aria-hidden style={dividerStyle("header")} />

      <PrintSideToggle />

      <div className="flex flex-col lg:flex-row lg:items-start" style={{ gap: "var(--editor-main-columns-gap)" }}>
        {!isPreview && (
          <aside style={{ width: "var(--editor-rail-width)", flexShrink: 0 }}>
            <ToolRail canvas={canvas} />
          </aside>
        )}

        <div className="flex flex-1 flex-col items-center" style={{ gap: "var(--editor-center-column-gap)" }}>
          <div
            className="relative flex items-center justify-center overflow-visible"
            style={{
              width: "var(--editor-canvas-card-width)",
              height: "var(--editor-canvas-card-height)",
              borderRadius: "var(--editor-canvas-card-radius)",
              backgroundColor: "var(--editor-canvas-card-bg)",
              padding: "var(--editor-canvas-card-padding)",
            }}
          >
            <div
              className="relative"
              style={{
                width: mockupPixelWidth,
                height: mockupPixelHeight,
                transform: "scale(var(--editor-canvas-scale))",
                transformOrigin: "top center",
              }}
            >
              <GarmentMockup
                garmentType={garmentType}
                side={side}
                color={color}
                className="absolute inset-0 h-full w-full"
              />
              <div
                className="absolute overflow-hidden"
                style={{
                  left: printArea.x * MOCKUP_DISPLAY_SCALE,
                  top: printArea.y * MOCKUP_DISPLAY_SCALE,
                  width: printArea.width * MOCKUP_DISPLAY_SCALE,
                  height: printArea.height * MOCKUP_DISPLAY_SCALE,
                }}
              >
                <FabricCanvas side={side} printArea={printArea} className="h-full w-full" onReady={setCanvas} />
              </div>

              <div
                className="pointer-events-none absolute flex justify-end"
                style={{
                  left: printArea.x * MOCKUP_DISPLAY_SCALE,
                  top: printArea.y * MOCKUP_DISPLAY_SCALE - 40,
                  width: printArea.width * MOCKUP_DISPLAY_SCALE,
                }}
              >
                <div className="pointer-events-auto">
                  <ObjectControls canvas={canvas} />
                </div>
              </div>
            </div>
          </div>

          {!isPreview && <CanvasControlStrip canvas={canvas} />}
        </div>

        {!isPreview && (
          <aside className="flex w-full flex-col lg:w-72" style={{ gap: "var(--editor-right-panel-gap)" }}>
            <GarmentPicker />

            <div
              className="flex flex-col overflow-hidden"
              style={{ gap: "var(--editor-secondary-btn-gap)", ...blockBorderStyle("secondary-block") }}
            >
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                className="flex w-full flex-shrink-0 items-center justify-center gap-1.5 px-3 font-semibold uppercase tracking-wide text-ink-200 transition-colors hover:brightness-125 hover:text-white"
                style={{
                  height: "var(--editor-secondary-btn-height)",
                  borderRadius: "var(--editor-secondary-btn-radius)",
                  backgroundColor: "var(--editor-secondary-btn-bg)",
                  fontSize: "var(--editor-secondary-btn-font-size)",
                }}
              >
                👁 {t("editor.preview")}
              </button>
              <div aria-hidden style={dividerStyle("secondary")} />
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex w-full flex-shrink-0 items-center justify-center gap-1.5 px-3 font-semibold uppercase tracking-wide text-ink-200 transition-colors hover:brightness-125 hover:text-white"
                style={{
                  height: "var(--editor-secondary-btn-height)",
                  borderRadius: "var(--editor-secondary-btn-radius)",
                  backgroundColor: "var(--editor-secondary-btn-bg)",
                  fontSize: "var(--editor-secondary-btn-font-size)",
                }}
              >
                ⛶ {t("editor.fullscreen")}
              </button>
            </div>

            <PriceAndPrint onPrint={() => setShowNextNotice(true)} />
          </aside>
        )}

        {isPreview && (
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className="rounded-full bg-ink-800 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-ink-700"
          >
            ✕ {t("editor.exitPreview")}
          </button>
        )}
      </div>

      {!isPreview && (
        <>
          <PopularElementsStrip canvas={canvas} />
          <TipsBar />
        </>
      )}

      {showNextNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {t("editor.nextPlaceholder")}
        </div>
      )}
    </div>
  );
}
