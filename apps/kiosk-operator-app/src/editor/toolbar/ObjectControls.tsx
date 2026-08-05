import { useEffect, useRef, useState } from "react";
import { FlipHorizontal, FlipVertical, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Canvas, FabricObject, TPointerEvent } from "fabric";
import { MOCKUP_DISPLAY_SCALE, type PrintAreaRect } from "../mockup/garmentShape.js";
import { SELECTION_BORDER_COLOR, SELECTION_CORNER_COLOR } from "../canvasSelectionStyle.js";
import { useEditorStore } from "../store.js";
import { recordHistoryEntry } from "../history.js";
import { editorThemeSection } from "../themeSections.js";

export interface ObjectControlsProps {
  canvas: Canvas | null;
  printArea: PrintAreaRect;
}

interface SelectionGeometry {
  /** Mockup-space corners: tl, tr, br, bl */
  corners: { x: number; y: number }[];
  /** Toolbar anchor above the selection (mockup space). */
  panelLeft: number;
  panelTop: number;
}

type HandleKey = "tl" | "tr" | "br" | "bl" | "mt" | "mb" | "ml" | "mr";

const PANEL_GAP_PX = 8;
const HANDLE_SIZE_PX = 28;
const BORDER_WIDTH_PX = 3;
const MIN_SCALE = 0.05;

const HANDLE_KEYS: HandleKey[] = ["tl", "tr", "br", "bl", "mt", "mb", "ml", "mr"];

function sceneToMockup(printArea: PrintAreaRect, x: number, y: number) {
  return {
    x: printArea.x * MOCKUP_DISPLAY_SCALE + x,
    y: printArea.y * MOCKUP_DISPLAY_SCALE + y,
  };
}

function readSelectionGeometry(canvas: Canvas, printArea: PrintAreaRect): SelectionGeometry | null {
  const active = canvas.getActiveObject();
  if (!active) return null;

  active.setCoords();
  const raw = active.getCoords();
  if (!raw[0] || !raw[1] || !raw[2] || !raw[3]) return null;
  const corners = [raw[0], raw[1], raw[2], raw[3]].map((point) =>
    sceneToMockup(printArea, point.x, point.y),
  );

  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));

  return {
    corners,
    panelLeft: (minX + maxX) / 2,
    panelTop: minY,
  };
}

function midpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function handlePosition(
  corners: { x: number; y: number }[],
  key: HandleKey,
): { x: number; y: number } | null {
  const tl = corners[0];
  const tr = corners[1];
  const br = corners[2];
  const bl = corners[3];
  if (!tl || !tr || !br || !bl) return null;
  switch (key) {
    case "tl":
      return tl;
    case "tr":
      return tr;
    case "br":
      return br;
    case "bl":
      return bl;
    case "mt":
      return midpoint(tl, tr);
    case "mb":
      return midpoint(bl, br);
    case "ml":
      return midpoint(tl, bl);
    case "mr":
      return midpoint(tr, br);
  }
}

function handleCursor(key: HandleKey): string {
  switch (key) {
    case "tl":
    case "br":
      return "nwse-resize";
    case "tr":
    case "bl":
      return "nesw-resize";
    case "mt":
    case "mb":
      return "ns-resize";
    case "ml":
    case "mr":
      return "ew-resize";
  }
}

/**
 * Selection chrome (frame + resize handles) and floating delete/flip buttons —
 * all on one DOM overlay above the mockup so nothing is clipped by the print area.
 */
export function ObjectControls({ canvas, printArea }: ObjectControlsProps) {
  const { t } = useTranslation();
  const hasSelection = useEditorStore((state) => state.hasSelection);
  const [geometry, setGeometry] = useState<SelectionGeometry | null>(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    if (!canvas) {
      setGeometry(null);
      return;
    }

    const refresh = () => {
      if (resizingRef.current) {
        setGeometry(readSelectionGeometry(canvas, printArea));
        return;
      }
      setGeometry(readSelectionGeometry(canvas, printArea));
    };

    refresh();

    const events = [
      "selection:created",
      "selection:updated",
      "selection:cleared",
      "object:moving",
      "object:scaling",
      "object:rotating",
      "object:skewing",
      "object:modified",
    ] as const;

    events.forEach((event) => canvas.on(event, refresh));
    return () => {
      events.forEach((event) => canvas.off(event, refresh));
    };
  }, [canvas, printArea]);

  function withActiveObject(action: (active: FabricObject) => void) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;
    action(active);
    active.setCoords();
    canvas.requestRenderAll();
    setGeometry(readSelectionGeometry(canvas, printArea));
    recordHistoryEntry(canvas);
  }

  function handleDelete() {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length === 0) return;
    canvas.discardActiveObject();
    canvas.remove(...activeObjects);
    canvas.requestRenderAll();
    setGeometry(null);
  }

  function beginResize(key: HandleKey, event: React.PointerEvent<HTMLElement>) {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    resizingRef.current = true;
    const startScene = canvas.getScenePoint(event.nativeEvent as TPointerEvent);
    const startScaleX = active.scaleX ?? 1;
    const startScaleY = active.scaleY ?? 1;
    const baseWidth = Math.max(active.width ?? 1, 1);
    const baseHeight = Math.max(active.height ?? 1, 1);
    const isCorner = key === "tl" || key === "tr" || key === "bl" || key === "br";

    const onMove = (moveEvent: PointerEvent) => {
      const point = canvas.getScenePoint(moveEvent as TPointerEvent);
      if (isCorner) {
        const center = active.getCenterPoint();
        const startDist = startScene.distanceFrom(center);
        if (startDist < 1) return;
        const ratio = point.distanceFrom(center) / startDist;
        const next = Math.max(MIN_SCALE, startScaleX * ratio);
        // Keep aspect ratio from the starting scales.
        const aspect = startScaleY / startScaleX;
        active.set({
          scaleX: next,
          scaleY: Math.max(MIN_SCALE, next * aspect),
        });
      } else {
        const center = active.getCenterPoint();
        const radians = ((active.angle ?? 0) * Math.PI) / 180;
        const axisX = { x: Math.cos(radians), y: Math.sin(radians) };
        const axisY = { x: -Math.sin(radians), y: Math.cos(radians) };
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        const localX = dx * axisX.x + dy * axisX.y;
        const localY = dx * axisY.x + dy * axisY.y;
        if (key === "ml" || key === "mr") {
          active.set({ scaleX: Math.max(MIN_SCALE, (Math.abs(localX) * 2) / baseWidth) });
        } else {
          active.set({ scaleY: Math.max(MIN_SCALE, (Math.abs(localY) * 2) / baseHeight) });
        }
      }
      active.setCoords();
      canvas.requestRenderAll();
      setGeometry(readSelectionGeometry(canvas, printArea));
    };

    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      active.setCoords();
      canvas.requestRenderAll();
      setGeometry(readSelectionGeometry(canvas, printArea));
      // Lets FabricCanvas recompute print size + history (same path as native transforms).
      canvas.fire("object:modified", { target: active });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  if (!hasSelection || !geometry) return null;

  const controlBtnStyle = {
    width: "var(--editor-objctrl-btn-width)",
    height: "var(--editor-objctrl-btn-height)",
    boxSizing: "border-box" as const,
  };

  const iconSize = "calc(var(--editor-objctrl-btn-width) * 0.45)";
  const tl = geometry.corners[0];
  const tr = geometry.corners[1];
  const br = geometry.corners[2];
  const bl = geometry.corners[3];
  if (!tl || !tr || !br || !bl) return null;
  const polygonPoints = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-10" data-editor-selection-ui>
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        <polygon
          points={polygonPoints}
          fill="none"
          stroke={SELECTION_BORDER_COLOR}
          strokeWidth={BORDER_WIDTH_PX}
          strokeLinejoin="round"
        />
      </svg>

      {HANDLE_KEYS.map((key) => {
        const pos = handlePosition(geometry.corners, key);
        if (!pos) return null;
        return (
          <div
            key={key}
            role="slider"
            aria-label={key}
            className="pointer-events-auto absolute touch-none"
            style={{
              left: pos.x,
              top: pos.y,
              width: HANDLE_SIZE_PX,
              height: HANDLE_SIZE_PX,
              transform: "translate(-50%, -50%)",
              backgroundColor: SELECTION_CORNER_COLOR,
              border: "2px solid #ffffff",
              boxSizing: "border-box",
              cursor: handleCursor(key),
            }}
            onPointerDown={(event) => beginResize(key, event)}
          />
        );
      })}

      <div
        className="pointer-events-none absolute"
        style={{
          left: geometry.panelLeft,
          top: geometry.panelTop,
          transform: `translate(-50%, calc(-100% - ${PANEL_GAP_PX}px))`,
        }}
      >
        <div
          className="pointer-events-auto flex items-center gap-2 bg-ink-950/90 px-2 py-1.5 shadow-lg backdrop-blur"
          {...editorThemeSection("objectControls")}
          style={{ borderRadius: "var(--editor-objctrl-bar-radius)" }}
        >
          <button
            type="button"
            onClick={handleDelete}
            title={t("editor.toolbar.delete")}
            style={{
              ...controlBtnStyle,
              backgroundColor: "var(--editor-objctrl-delete-bg)",
              borderRadius: "var(--editor-objctrl-bar-radius)",
            }}
            className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110"
          >
            <Trash2 aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => withActiveObject((active) => active.set("flipX", !active.flipX))}
            title={t("editor.toolbar.flipHorizontal")}
            style={{
              ...controlBtnStyle,
              backgroundColor: "var(--editor-objctrl-bg)",
              borderRadius: "var(--editor-objctrl-bar-radius)",
            }}
            className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110 hover:brightness-125"
          >
            <FlipHorizontal aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => withActiveObject((active) => active.set("flipY", !active.flipY))}
            title={t("editor.toolbar.flipVertical")}
            style={{
              ...controlBtnStyle,
              backgroundColor: "var(--editor-objctrl-bg)",
              borderRadius: "var(--editor-objctrl-bar-radius)",
            }}
            className="flex shrink-0 items-center justify-center text-white transition-transform hover:scale-110 hover:brightness-125"
          >
            <FlipVertical aria-hidden style={{ width: iconSize, height: iconSize }} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}
