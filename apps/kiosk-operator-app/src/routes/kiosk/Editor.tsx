import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import { designCategorySchema, type GarmentFabric } from "@tshirt/shared-types";
import { getPriceBreakdown } from "@tshirt/shared-pricing";
import { createOrder, fetchDesign, markDesignUsed, resolveDesignImageUrl } from "../../lib/pointServer.js";
import { initPricingConfig, usePricingConfigStore } from "../../lib/pricingConfigStore.js";
import { initPrintAreaConfig, usePrintAreaStore } from "../../lib/printAreaStore.js";
import { useEditorStore } from "../../editor/store.js";
import { useAiFlowStore } from "../../lib/aiFlowStore.js";
import { useCheckoutStore } from "../../lib/checkoutStore.js";
import { placeImageCentered } from "../../editor/canvasImage.js";
import { computePrintSize } from "../../editor/printSize.js";
import { FabricCanvas } from "../../editor/FabricCanvas.js";
import { GarmentPicker } from "../../editor/GarmentPicker.js";
import { PrintSideToggle } from "../../editor/PrintSideToggle.js";
import { PriceAndPrint } from "../../editor/PriceAndPrint.js";
import { ToolRail } from "../../editor/toolbar/ToolRail.js";
import { ObjectControls } from "../../editor/toolbar/ObjectControls.js";
import { CanvasControlStrip } from "../../editor/toolbar/CanvasControlStrip.js";
import { PopularElementsStrip } from "../../editor/toolbar/PopularElementsStrip.js";
import { TipsBar } from "../../editor/toolbar/TipsBar.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { ArrowLeft } from "../../components/icons.js";
import { CATEGORY_LABEL_KEYS, getEditorBackRoute } from "../../lib/categoryLabels.js";
import { blockBorderStyle, dividerStyle } from "../../editor/borderStyle.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  useFabricShadingOverlayStyle,
  useTshirtSilhouetteUrl,
} from "../../editor/mockup/index.js";

export function Editor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const garmentType = useEditorStore((state) => state.garmentType);
  const side = useEditorStore((state) => state.side);
  const color = useEditorStore((state) => state.color);
  const size = useEditorStore((state) => state.size);
  const fabricName = useEditorStore((state) => state.fabricName);
  const priceConfig = usePricingConfigStore((state) => state.config);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [printError, setPrintError] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const appliedDesignIdRef = useRef<string | null>(null);
  const appliedAiImageRef = useRef<string | null>(null);

  useEffect(() => {
    initPricingConfig();
    initPrintAreaConfig();
  }, []);

  const categoryParam = designCategorySchema.safeParse(searchParams.get("category"));
  const category = categoryParam.success ? categoryParam.data : null;
  const categoryLabel = category ? t(CATEGORY_LABEL_KEYS[category]) : null;
  const backRoute = getEditorBackRoute(category);
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
        // `crossOrigin: "anonymous"` is required here — point-server runs on a
        // different origin than the kiosk app, and without it the browser
        // marks the whole Fabric canvas as "tainted". That doesn't break the
        // on-screen preview, but `canvas.toDataURL()` in `handlePrint` then
        // throws a SecurityError for *any* subsequent export, so the order
        // (and therefore printing) silently never goes through.
        return FabricImage.fromURL(resolveDesignImageUrl(design.imageUrl), { crossOrigin: "anonymous" }).then((image) => {
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

  // ИИ-раздел (Этап 9) — picks up the print-ready `finalImage` (stylized +
  // background-removed) left in `aiFlowStore` by `AiResult.tsx`'s
  // "Редактировать на футболке" button. No `crossOrigin` needed — it's a
  // local data URL, not a cross-origin point-server URL like `designId`
  // above. Guarded by a ref (same pattern as `appliedDesignIdRef`) so a
  // canvas remount doesn't re-add the same image twice; resets the AI flow
  // store once applied so a later fresh visit to `/kiosk/ai` starts clean.
  useEffect(() => {
    if (!canvas || category !== "ai_style") return;
    const finalImage = useAiFlowStore.getState().finalImage;
    if (!finalImage || appliedAiImageRef.current === finalImage) return;
    appliedAiImageRef.current = finalImage;

    let cancelled = false;
    void FabricImage.fromURL(finalImage).then((image) => {
      if (cancelled) return;
      placeImageCentered(canvas, image);
      useAiFlowStore.getState().reset();
    });

    return () => {
      cancelled = true;
    };
  }, [canvas, category]);

  const printAreas = usePrintAreaStore((state) => state.areas);
  const printArea = printAreas[garmentType][side];
  const tshirtImageUrl = useTshirtSilhouetteUrl(color, side);
  const fabricShadingOverlayStyle = useFabricShadingOverlayStyle(garmentType, side, color, printArea);
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }

  async function handlePrint() {
    if (!canvas || isCreatingOrder) return;
    setPrintError(false);
    setIsCreatingOrder(true);

    try {
      const printSize = computePrintSize(canvas);
      const canvasSnapshot = JSON.stringify(canvas.toJSON());
      // Transparent-background PNG of just the design (no garment) — point-server
      // composites it onto the garment mockup via sharp (see Stage 5).
      // Kept inside this try/catch — a tainted canvas (e.g. a cross-origin
      // image loaded without `crossOrigin`) makes this throw a SecurityError,
      // which must not skip the error handling/`finally` below.
      const designImageBase64 = canvas.toDataURL({ format: "png", multiplier: 2 });
      const priceBreakdown = getPriceBreakdown(
        {
          garmentType,
          fabric: fabricName as GarmentFabric,
          size,
          printSize,
        },
        priceConfig,
      );
      const price = priceBreakdown.reduce((sum, line) => sum + line.amountTenge, 0);

      useEditorStore.getState().setPrintSize(side, printSize);
      useEditorStore.getState().setCanvasSnapshot(side, canvasSnapshot);

      const order = await createOrder({
        garmentType,
        garmentColor: color,
        garmentSize: size,
        garmentFabric: fabricName,
        side,
        printSize,
        price,
        designImageBase64,
      });
      useCheckoutStore.getState().setDraft(
        { type: garmentType, color, size, fabricName, side, canvasSnapshot },
        priceBreakdown,
      );
      useCheckoutStore.getState().setOrder(order);
      // Real "used by a customer" signal for the hearts badge/popularity
      // ranking — only fires for designs picked from a category gallery
      // (custom/text/ai_style flows have no `designId`). Fire-and-forget:
      // the order already succeeded, a stats bump failing shouldn't block
      // checkout (fail-open).
      if (designId) {
        void markDesignUsed(designId).catch(() => {});
      }
      navigate("/kiosk/checkout");
    } catch {
      setPrintError(true);
    } finally {
      setIsCreatingOrder(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className="editor-theme-root flex h-full w-full flex-col overflow-hidden px-4 py-8 text-white"
      style={{ backgroundColor: "var(--editor-page-bg)", gap: "var(--editor-page-section-gap)" }}
    >
      <header className="relative flex items-center justify-between gap-4">
        <Link
          to={backRoute}
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
        <LanguageSwitcherSlot />
      </header>

      <div aria-hidden style={dividerStyle("header")} />

      <PrintSideToggle />

      <div
        className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-start"
        style={{ gap: "var(--editor-main-columns-gap)" }}
      >
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: "var(--editor-center-column-gap)" }}
        >
          <div className="flex flex-col lg:flex-row lg:items-start" style={{ gap: "var(--editor-main-columns-gap)" }}>
            {!isPreview && (
              <aside style={{ width: "var(--editor-rail-width)", flexShrink: 0 }}>
                <ToolRail canvas={canvas} />
              </aside>
            )}

            <div className="flex min-w-0 flex-1 flex-col items-center" style={{ gap: "var(--editor-center-column-gap)" }}>
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
                    className="absolute overflow-visible"
                    style={{
                      left: printArea.x * MOCKUP_DISPLAY_SCALE,
                      top: printArea.y * MOCKUP_DISPLAY_SCALE,
                      width: printArea.width * MOCKUP_DISPLAY_SCALE,
                      height: printArea.height * MOCKUP_DISPLAY_SCALE,
                    }}
                  >
                    <FabricCanvas
                      side={side}
                      printArea={printArea}
                      garmentType={garmentType}
                      tshirtImageUrl={garmentType === "tshirt" ? tshirtImageUrl : undefined}
                      className="h-full w-full"
                      onReady={setCanvas}
                    />
                    <div className="absolute inset-0" style={fabricShadingOverlayStyle} />
                  </div>

                  <ObjectControls canvas={canvas} printArea={printArea} />
                </div>
              </div>

              {!isPreview && <CanvasControlStrip canvas={canvas} />}
            </div>
          </div>
        </div>

        {!isPreview && (
          <aside
            className="flex w-full flex-shrink-0 flex-col lg:w-[var(--editor-right-panel-width)]"
            style={{ gap: "var(--editor-right-panel-gap)" }}
          >
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
                <span aria-hidden style={{ fontSize: "var(--editor-secondary-btn-icon-size)" }}>
                  👁
                </span>
                {t("editor.preview")}
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
                <span aria-hidden style={{ fontSize: "var(--editor-secondary-btn-icon-size)" }}>
                  ⛶
                </span>
                {t("editor.fullscreen")}
              </button>
            </div>

            <PriceAndPrint onPrint={() => void handlePrint()} isSubmitting={isCreatingOrder} />
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

      {!isPreview && <PopularElementsStrip canvas={canvas} />}
      {!isPreview && <TipsBar />}

      {printError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {t("editor.printError")}
        </div>
      )}
    </div>
  );
}
