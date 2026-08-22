import { useEffect, useRef } from "react";
import { Canvas } from "fabric";
import type { GarmentSide, GarmentType } from "@tshirt/shared-types";
import {
  applyGarmentClipMaskToLowerCanvas,
  clearGarmentClipFromCanvas,
  installUnmaskedControlsRenderer,
  snapshotCanvasJson,
} from "./applyGarmentClipToCanvas.js";
import {
  applySelectionStyleToAllObjects,
  applySelectionStyleToObject,
  configureCanvasSelectionStyle,
} from "./canvasSelectionStyle.js";
import { getGarmentClipMaskStyle } from "./mockup/garmentClipMask.js";
import type { PrintAreaRect } from "./mockup/garmentShape.js";
import {
  applySelectionControlOverscan,
  computeMockupControlOverscan,
  getMockupPixelSize,
} from "./selectionControlOverscan.js";
import { useEditorStore } from "./store.js";
import { syncPrintSizeFromCanvas } from "./printSize.js";
import { initHistoryForSide, isHistorySuspended, recordHistoryEntry, setHistorySuspended } from "./history.js";

export interface FabricCanvasProps {
  side: GarmentSide;
  printArea: PrintAreaRect;
  garmentType: GarmentType;
  imageUrl?: string;
  className?: string;
  onReady: (canvas: Canvas | null) => void;
}

export function FabricCanvas({
  side,
  printArea,
  garmentType,
  imageUrl,
  className,
  onReady,
}: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const printAreaRef = useRef(printArea);
  printAreaRef.current = printArea;
  const setHasSelection = useEditorStore((state) => state.setHasSelection);
  /** Tracks which side is currently loaded into the live canvas instance. */
  const loadedSideRef = useRef<GarmentSide>(side);

  function syncViewportAndClip(canvas: Canvas, area: PrintAreaRect = printAreaRef.current) {
    const overscan = computeMockupControlOverscan(area);
    applySelectionControlOverscan(canvas, overscan);
    const maskStyle = getGarmentClipMaskStyle({
      garmentType,
      side: loadedSideRef.current,
      printArea: area,
      imageUrl,
      canvasOverscanLeftPx: overscan.left,
      canvasOverscanTopPx: overscan.top,
    });
    applyGarmentClipMaskToLowerCanvas(canvas, maskStyle, { controlOverscan: overscan });
    canvas.requestRenderAll();
  }

  useEffect(() => {
    if (!canvasElRef.current) return;

    configureCanvasSelectionStyle();

    const size = getMockupPixelSize();
    const canvas = new Canvas(canvasElRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
      // Touch-first hit testing — same path for mouse and finger on the kiosk.
      targetFindTolerance: 12,
    });
    syncViewportAndClip(canvas, printArea);
    configureCanvasSelectionStyle(canvas);
    const uninstallControlsRenderer = installUnmaskedControlsRenderer(canvas);
    canvasRef.current = canvas;
    loadedSideRef.current = side;
    onReady(canvas);

    canvas.on("selection:created", () => setHasSelection(true));
    canvas.on("selection:updated", () => setHasSelection(true));
    canvas.on("selection:cleared", () => setHasSelection(false));

    // Deselect on empty-canvas clicks — clicking an object itself already
    // sets `e.target`, so this only fires for genuine background clicks.
    canvas.on("mouse:down", (event) => {
      if (!event.target) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });

    function recomputePrintSize() {
      if (isHistorySuspended()) return;
      const currentSide = loadedSideRef.current;
      syncPrintSizeFromCanvas(currentSide, canvas);
      useEditorStore.getState().setCanvasSnapshot(currentSide, snapshotCanvasJson(canvas));
    }

    canvas.on("object:added", (event) => {
      if (event.target) {
        applySelectionStyleToObject(event.target);
      }
      recomputePrintSize();
      recordHistoryEntry(canvas);
    });
    canvas.on("object:removed", () => {
      recomputePrintSize();
      recordHistoryEntry(canvas);
    });
    canvas.on("object:modified", () => {
      recomputePrintSize();
      recordHistoryEntry(canvas);
    });

    const initialSnapshot = useEditorStore.getState().canvasSnapshots[side];
    setHistorySuspended(true);
    if (initialSnapshot) {
      void canvas.loadFromJSON(initialSnapshot).then(() => {
        syncViewportAndClip(canvas);
        applySelectionStyleToAllObjects(canvas);
        syncPrintSizeFromCanvas(loadedSideRef.current, canvas);
        useEditorStore.getState().setCanvasSnapshot(loadedSideRef.current, snapshotCanvasJson(canvas));
        setHistorySuspended(false);
        initHistoryForSide(side, snapshotCanvasJson(canvas));
      });
    } else {
      setHistorySuspended(false);
      initHistoryForSide(side, snapshotCanvasJson(canvas));
    }

    return () => {
      uninstallControlsRenderer();
      clearGarmentClipFromCanvas(canvas);
      useEditorStore.getState().setCanvasSnapshot(loadedSideRef.current, snapshotCanvasJson(canvas));
      canvasRef.current = null;
      onReady(null);
      void canvas.dispose();
    };
    // Canvas is created once per mount; side/printArea changes are handled by the effects below.
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = getMockupPixelSize();
    canvas.setDimensions({
      width: size.width,
      height: size.height,
    });
    syncViewportAndClip(canvas, printArea);
  }, [printArea.width, printArea.height, printArea.x, printArea.y, garmentType, imageUrl, side]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedSideRef.current === side) return;

    const previousSide = loadedSideRef.current;
    syncPrintSizeFromCanvas(previousSide, canvas);
    useEditorStore.getState().setCanvasSnapshot(previousSide, snapshotCanvasJson(canvas));
    loadedSideRef.current = side;

    setHistorySuspended(true);
    canvas.clear();
    const snapshot = useEditorStore.getState().canvasSnapshots[side];
    if (snapshot) {
      void canvas.loadFromJSON(snapshot).then(() => {
        if (loadedSideRef.current !== side) return;
        syncViewportAndClip(canvas);
        applySelectionStyleToAllObjects(canvas);
        syncPrintSizeFromCanvas(side, canvas);
        setHistorySuspended(false);
        initHistoryForSide(side, snapshotCanvasJson(canvas));
      });
    } else {
      syncPrintSizeFromCanvas(side, canvas);
      syncViewportAndClip(canvas);
      setHistorySuspended(false);
      initHistoryForSide(side, snapshotCanvasJson(canvas));
    }
  }, [side]);

  return (
    <div className={className} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {/*
        Bitmap matches the full mockup. Scene coords stay print-area-relative
        via viewportTransform; design pixels are clipped to the print rect on
        the lower canvas while selection controls use the unclipped upper layer.
      */}
      <canvas ref={canvasElRef} className="h-full w-full" />
    </div>
  );
}
