import { useEffect, useRef } from "react";
import { Canvas } from "fabric";
import type { GarmentSide } from "@tshirt/shared-types";
import { useEditorStore } from "./store.js";
import { MOCKUP_DISPLAY_SCALE, type PrintAreaRect } from "./mockup/garmentShape.js";

export interface FabricCanvasProps {
  side: GarmentSide;
  printArea: PrintAreaRect;
  className?: string;
  onReady: (canvas: Canvas | null) => void;
}

export function FabricCanvas({ side, printArea, className, onReady }: FabricCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const setHasSelection = useEditorStore((state) => state.setHasSelection);
  /** Tracks which side is currently loaded into the live canvas instance. */
  const loadedSideRef = useRef<GarmentSide>(side);

  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: printArea.width * MOCKUP_DISPLAY_SCALE,
      height: printArea.height * MOCKUP_DISPLAY_SCALE,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
    });
    canvasRef.current = canvas;
    loadedSideRef.current = side;
    onReady(canvas);

    canvas.on("selection:created", () => setHasSelection(true));
    canvas.on("selection:updated", () => setHasSelection(true));
    canvas.on("selection:cleared", () => setHasSelection(false));

    const initialSnapshot = useEditorStore.getState().canvasSnapshots[side];
    if (initialSnapshot) {
      void canvas.loadFromJSON(initialSnapshot).then(() => canvas.requestRenderAll());
    }

    return () => {
      useEditorStore.getState().setCanvasSnapshot(loadedSideRef.current, JSON.stringify(canvas.toJSON()));
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
  }, [printArea.width, printArea.height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loadedSideRef.current === side) return;

    const previousSide = loadedSideRef.current;
    useEditorStore.getState().setCanvasSnapshot(previousSide, JSON.stringify(canvas.toJSON()));
    loadedSideRef.current = side;

    canvas.clear();
    const snapshot = useEditorStore.getState().canvasSnapshots[side];
    if (snapshot) {
      void canvas.loadFromJSON(snapshot).then(() => canvas.requestRenderAll());
    } else {
      canvas.requestRenderAll();
    }
  }, [side]);

  return <canvas ref={canvasElRef} className={className} />;
}
