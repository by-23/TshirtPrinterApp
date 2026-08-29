import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FabricImage, type Canvas } from "fabric";
import {
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentTypeSchema,
  garmentUsesSizeFabric,
  isGarmentColorEnabled,
  isGarmentFabricEnabled,
  isGarmentSizeEnabled,
  isGarmentTypeEnabled,
  type GarmentFabric,
} from "@tshirt/shared-types";
import { getPriceBreakdown } from "@tshirt/shared-pricing";
import { createOrder, fetchDesign, markDesignUsed, resolveDesignImageUrl } from "../../lib/pointServer.js";
import { initPricingConfig, usePricingConfigStore } from "../../lib/pricingConfigStore.js";
import { initPrintAreaConfig, usePrintAreaStore } from "../../lib/printAreaStore.js";
import {
  initGarmentAvailabilityConfig,
  subscribeGarmentAvailabilityStore,
  useGarmentAvailabilityStore,
} from "../../lib/garmentAvailabilityStore.js";
import {
  deselectCanvasSelection,
  shouldDeselectCanvasOnPointerDown,
} from "../../editor/canvasSelectionStyle.js";
import { editorThemeSection } from "../../editor/themeSections.js";
import { useEditorStore } from "../../editor/store.js";
import { useAiFlowStore } from "../../lib/aiFlowStore.js";
import { useCheckoutStore } from "../../lib/checkoutStore.js";
import { placeImageCentered } from "../../editor/canvasImage.js";
import { exportDesignedSides } from "../../editor/exportOrderDesigns.js";
import { FabricCanvas } from "../../editor/FabricCanvas.js";
import { GarmentPicker } from "../../editor/GarmentPicker.js";
import { GarmentTypeToggle } from "../../editor/GarmentTypeToggle.js";
import { PrintSideToggle } from "../../editor/PrintSideToggle.js";
import { PriceAndPrint } from "../../editor/PriceAndPrint.js";
import { ToolRail } from "../../editor/toolbar/ToolRail.js";
import { ObjectControls } from "../../editor/toolbar/ObjectControls.js";
import { CanvasControlStrip } from "../../editor/toolbar/CanvasControlStrip.js";
import { PopularElementsStrip } from "../../editor/toolbar/PopularElementsStrip.js";
import { TipsBar } from "../../editor/toolbar/TipsBar.js";
import { LanguageSwitcherSlot } from "../../components/KioskShell.js";
import { ArrowLeft } from "../../components/icons.js";
import { CATEGORY_LABEL_KEYS, getEditorBackRoute, parseDesignCategoryParam } from "../../lib/categoryLabels.js";
import { blockBorderStyle, dividerStyle } from "../../editor/borderStyle.js";
import {
  GarmentMockup,
  MOCKUP_DISPLAY_SCALE,
  MOCKUP_HEIGHT,
  MOCKUP_WIDTH,
  useGarmentSilhouetteUrl,
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
  const setGarmentType = useEditorStore((state) => state.setGarmentType);
  const setColor = useEditorStore((state) => state.setColor);
  const setSize = useEditorStore((state) => state.setSize);
  const setFabricName = useEditorStore((state) => state.setFabricName);
  const priceConfig = usePricingConfigStore((state) => state.config);
  const availability = useGarmentAvailabilityStore((state) => state.availability);
  const availabilityLoaded = useGarmentAvailabilityStore((state) => state.loaded);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [printError, setPrintError] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const bottomToolDockRef = useRef<HTMLDivElement>(null);
  const appliedDesignIdRef = useRef<string | null>(null);
  const appliedAiImageRef = useRef<string | null>(null);

  useEffect(() => {
    initPricingConfig();
    initPrintAreaConfig();
    initGarmentAvailabilityConfig();
    return subscribeGarmentAvailabilityStore();
  }, []);

  // If the operator disabled the current selection, snap to the first enabled option.
  useEffect(() => {
    if (!availabilityLoaded) return;

    if (!isGarmentTypeEnabled(availability, garmentType)) {
      const nextType = garmentTypeSchema.options.find((type) => isGarmentTypeEnabled(availability, type));
      if (nextType) setGarmentType(nextType);
    }

    const activeColor = GARMENT_COLORS.find((option) => option.hex === color);
    if (!activeColor || !isGarmentColorEnabled(availability, activeColor.id)) {
      const nextColor = GARMENT_COLORS.find((option) => isGarmentColorEnabled(availability, option.id));
      if (nextColor) setColor(nextColor.hex);
    }

    if (garmentUsesSizeFabric(garmentType)) {
      if (!isGarmentSizeEnabled(availability, size)) {
        const nextSize = GARMENT_SIZES.find((option) => isGarmentSizeEnabled(availability, option));
        if (nextSize) setSize(nextSize);
      }
      if (!isGarmentFabricEnabled(availability, fabricName)) {
        const nextFabric = GARMENT_FABRICS.find((option) => isGarmentFabricEnabled(availability, option));
        if (nextFabric) setFabricName(nextFabric);
      }
    }
  }, [
    availability,
    availabilityLoaded,
    garmentType,
    color,
    size,
    fabricName,
    setGarmentType,
    setColor,
    setSize,
    setFabricName,
  ]);

  const category = parseDesignCategoryParam(searchParams.get("category"));
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
      useAiFlowStore.getState().clearAfterEditorApply();
    });

    return () => {
      cancelled = true;
    };
  }, [canvas, category]);

  const printAreas = usePrintAreaStore((state) => state.areas);
  const printArea = printAreas[garmentType][side];
  const garmentImageUrl = useGarmentSilhouetteUrl(garmentType, side);
  const mockupPixelWidth = MOCKUP_WIDTH * MOCKUP_DISPLAY_SCALE;
  const mockupPixelHeight = MOCKUP_HEIGHT * MOCKUP_DISPLAY_SCALE;

  function handleEditorPointerDownCapture(event: React.PointerEvent) {
    if (!shouldDeselectCanvasOnPointerDown(event.target, printAreaRef.current)) return;
    deselectCanvasSelection(canvas);
  }

  async function handlePrint() {
    if (!canvas || isCreatingOrder) return;
    setPrintError(false);
    setIsCreatingOrder(true);

    try {
      const designedSides = await exportDesignedSides(canvas, side, garmentType);
      const primary = designedSides[0];
      if (!primary) {
        throw new Error("no design");
      }
      const extra = designedSides[1];
      const aiProvider =
        category === "ai_style" ? useAiFlowStore.getState().aiProvider : ("standard" as const);
      const extraPrintSizes = designedSides.slice(1).map((item) => item.printSize);
      const priceBreakdown = getPriceBreakdown(
        {
          garmentType,
          fabric: fabricName as GarmentFabric,
          size,
          printSize: primary.printSize,
          extraPrintSizes,
          aiProvider,
        },
        priceConfig,
      );
      const price = priceBreakdown.reduce((sum, line) => sum + line.amountTenge, 0);

      const order = await createOrder({
        garmentType,
        garmentColor: color,
        garmentSize: size,
        garmentFabric: fabricName,
        side: primary.side,
        printSize: primary.printSize,
        price,
        designImageBase64: primary.designImageBase64,
        extraSides: extra
          ? [
              {
                side: extra.side,
                printSize: extra.printSize,
                designImageBase64: extra.designImageBase64,
              },
            ]
          : undefined,
      });
      useCheckoutStore.getState().setDraft(
        {
          type: garmentType,
          color,
          size,
          fabricName,
          side: primary.side,
          canvasSnapshot: primary.canvasSnapshot,
          designedSides: designedSides.map((item) => item.side),
        },
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
      onPointerDownCapture={handleEditorPointerDownCapture}
      className="editor-theme-root flex h-full w-full flex-col overflow-hidden px-4 py-8 text-white"
      style={{ backgroundColor: "var(--editor-page-bg)", gap: "var(--editor-page-section-gap)" }}
    >
      <header className="relative flex items-center justify-between gap-4" {...editorThemeSection("header")}>
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

      <GarmentTypeToggle />
      <PrintSideToggle />

      {/* Row is unconditional: viewport `lg:` sees the window, not the 1080 canvas. */}
      <div
        className="flex min-h-0 flex-1 flex-row items-start"
        style={{ gap: "var(--editor-main-columns-gap)" }}
      >
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: "var(--editor-center-column-gap)" }}
        >
          <div className="flex flex-row items-start" style={{ gap: "var(--editor-main-columns-gap)" }}>
            <aside
              className={isPreview ? "editor-preview-dimmed relative z-40" : "relative z-40"}
              aria-hidden={isPreview}
              data-editor-selection-ui
              style={{ width: "var(--editor-rail-width)", flexShrink: 0 }}
            >
              <ToolRail canvas={canvas} bottomToolDockRef={bottomToolDockRef} />
            </aside>

            <div className="flex min-w-0 flex-1 flex-col items-center" style={{ gap: "var(--editor-center-column-gap)" }}>
              <div
                className="relative flex items-center justify-center overflow-visible"
                {...editorThemeSection("canvasCard")}
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
                  {/*
                    Selection controls layer spans the whole central mockup block
                    (not just the print-area rect), so resize handles are never
                    clipped by the allowed print zone.
                  */}
                  <div ref={printAreaRef} className="absolute inset-0 overflow-visible">
                    <FabricCanvas
                      side={side}
                      printArea={printArea}
                      garmentType={garmentType}
                      imageUrl={garmentImageUrl}
                      onReady={setCanvas}
                    />
                  </div>

                  <ObjectControls canvas={canvas} printArea={printArea} />
                </div>
              </div>

              <div
                className={isPreview ? "editor-preview-dimmed relative z-10" : "relative z-10"}
                aria-hidden={isPreview}
                style={{
                  width: "var(--editor-strip-width, var(--editor-canvas-card-width))",
                  maxWidth: "100%",
                }}
              >
                <CanvasControlStrip canvas={canvas} />
              </div>
            </div>
          </div>
        </div>

        <aside
          className={`flex w-[var(--editor-right-panel-width)] flex-shrink-0 flex-col ${isPreview ? "editor-preview-dimmed" : ""}`}
          aria-hidden={isPreview}
          {...editorThemeSection("rightPanel")}
          style={{ gap: "var(--editor-right-panel-gap)" }}
        >
          <GarmentPicker />

          <div
            className="flex flex-col overflow-hidden"
            {...editorThemeSection("preview")}
            style={blockBorderStyle("secondary-block")}
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
          </div>

          <PriceAndPrint onPrint={() => void handlePrint()} isSubmitting={isCreatingOrder} />
        </aside>
      </div>

      <div
        ref={bottomToolDockRef}
        data-editor-bottom-tool-dock
        className={isPreview ? "editor-preview-dimmed relative z-50 w-full" : "relative z-50 w-full"}
        aria-hidden={isPreview}
      />

      <div className={isPreview ? "editor-preview-dimmed" : undefined} aria-hidden={isPreview}>
        <PopularElementsStrip canvas={canvas} />
      </div>
      <div className={isPreview ? "editor-preview-dimmed" : undefined} aria-hidden={isPreview}>
        <TipsBar />
      </div>

      {isPreview && (
        <button
          type="button"
          onClick={() => setIsPreview(false)}
          aria-label={t("editor.exitPreview")}
          className="fixed inset-0 z-50 cursor-pointer border-0 bg-transparent p-0"
        >
          <span className="pointer-events-none fixed bottom-8 right-8 rounded-full bg-ink-800 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-2xl">
            ✕ {t("editor.exitPreview")}
          </span>
        </button>
      )}

      {printError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {t("editor.printError")}
        </div>
      )}
    </div>
  );
}
