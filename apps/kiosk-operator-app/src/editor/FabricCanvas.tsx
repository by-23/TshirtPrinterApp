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
import { MOCKUP_DISPLAY_SCALE, type PrintAreaRect } from "./mockup/garmentShape.js";
import { useEditorStore } from "./store.js";
import { computePrintSize } from "./printSize.js";
import { initHistoryForSide, recordHistoryEntry, setHistorySuspended } from "./history.js";

export interface FabricCanvasProps {
  side: GarmentSide;
  printArea: PrintAreaRect;
  garmentType: GarmentType;
  tshirtImageUrl?: string;
  className?: string;
  onReady: (canvas: Canvas | null) => void;
}

export function FabricCanvas({
  side,
  printArea,
  garmentType,
  tshirtImageUrl,
  className,
  onReady,
}: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const setHasSelection = useEditorStore((state) => state.setHasSelection);
  /** Tracks which side is currently loaded into the live canvas instance. */
  const loadedSideRef = useRef<GarmentSide>(side);

  function syncGarmentClip(canvas: Canvas) {
    const maskStyle = getGarmentClipMaskStyle({
      garmentType,
      side: loadedSideRef.current,
      printArea,
      tshirtImageUrl,
    });
    applyGarmentClipMaskToLowerCanvas(canvas, maskStyle);
    canvas.requestRenderAll();
  }

  useEffect(() => {
    if (!canvasElRef.current) return;

    configureCanvasSelectionStyle();

    const canvas = new Canvas(canvasElRef.current, {
      width: printArea.width * MOCKUP_DISPLAY_SCALE,
      height: printArea.height * MOCKUP_DISPLAY_SCALE,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
    });
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
      useEditorStore.getState().setPrintSize(loadedSideRef.current, computePrintSize(canvas));
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
        applySelectionStyleToAllObjects(canvas);
        syncGarmentClip(canvas);
        recomputePrintSize();
        setHistorySuspended(false);
        initHistoryForSide(side, snapshotCanvasJson(canvas));
      });
    } else {
      syncGarmentClip(canvas);
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
    canvas.setDimensions({
      width: printArea.width * MOCKUP_DISPLAY_SCALE,
      height: printArea.height * MOCKUP_DISPLAY_SCALE,
    });
    syncGarmentClip(canvas);
  }, [printArea.width, printArea.height, printArea.x, printArea.y, garmentType, tshirtImageUrl, side]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedSideRef.current === side) return;

    const previousSide = loadedSideRef.current;
    useEditorStore.getState().setCanvasSnapshot(previousSide, snapshotCanvasJson(canvas));
    loadedSideRef.current = side;

    setHistorySuspended(true);
    canvas.clear();
    const snapshot = useEditorStore.getState().canvasSnapshots[side];
    if (snapshot) {
      void canvas.loadFromJSON(snapshot).then(() => {
        applySelectionStyleToAllObjects(canvas);
        syncGarmentClip(canvas);
        useEditorStore.getState().setPrintSize(side, computePrintSize(canvas));
        setHistorySuspended(false);
        initHistoryForSide(side, snapshotCanvasJson(canvas));
      });
    } else {
      syncGarmentClip(canvas);
      useEditorStore.getState().setPrintSize(side, computePrintSize(canvas));
      setHistorySuspended(false);
      initHistoryForSide(side, snapshotCanvasJson(canvas));
    }
  }, [side]);

  return <canvas ref={canvasElRef} className={className} />;
}
