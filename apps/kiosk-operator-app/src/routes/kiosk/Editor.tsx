import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import { designCategorySchema } from "@tshirt/shared-types";
import { useEditorStore } from "../../editor/store.js";
import { FabricCanvas } from "../../editor/FabricCanvas.js";
import { GarmentPicker } from "../../editor/GarmentPicker.js";
import { GarmentTypeToggle } from "../../editor/GarmentTypeToggle.js";
import { PriceAndPrint } from "../../editor/PriceAndPrint.js";
import { ToolRail } from "../../editor/toolbar/ToolRail.js";
import { ObjectControls } from "../../editor/toolbar/ObjectControls.js";
import { CanvasControlStrip } from "../../editor/toolbar/CanvasControlStrip.js";
import { PopularElementsStrip } from "../../editor/toolbar/PopularElementsStrip.js";
import { TipsBar } from "../../editor/toolbar/TipsBar.js";
import { LanguageSwitcher } from "../../components/LanguageSwitcher.js";
import { CATEGORY_LABEL_KEYS } from "../../lib/categoryLabels.js";
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

  const categoryParam = designCategorySchema.safeParse(searchParams.get("category"));
  const categoryLabel = categoryParam.success ? t(CATEGORY_LABEL_KEYS[categoryParam.data]) : null;

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
    <div ref={containerRef} className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-ink-950 p-4 text-white">
      <header className="flex items-center justify-between gap-4">
        <Link
          to="/kiosk"
          aria-label={t("common.back")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-800 text-lg text-white transition-colors hover:bg-ink-700"
        >
          ←
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide sm:text-xl">{t("editor.title")}</h1>
          {categoryLabel && (
            <p className="text-xs font-semibold uppercase tracking-wide text-neon-pink">{categoryLabel}</p>
          )}
        </div>
        <LanguageSwitcher />
      </header>

      <GarmentTypeToggle />

      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        {!isPreview && (
          <aside className="w-full lg:w-20">
            <ToolRail canvas={canvas} />
          </aside>
        )}

        <div className="flex flex-1 flex-col items-center gap-3">
          <div className="relative rounded-3xl border border-ink-700 bg-ink-900 p-6">
            <div className="relative" style={{ width: mockupPixelWidth, height: mockupPixelHeight }}>
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
          <aside className="flex w-full flex-col gap-5 lg:w-72">
            <GarmentPicker />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-200 transition-colors hover:bg-ink-700 hover:text-white"
              >
                👁 {t("editor.preview")}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-200 transition-colors hover:bg-ink-700 hover:text-white"
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
