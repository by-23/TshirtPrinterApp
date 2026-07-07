import { useCallback, useEffect, useRef, useState } from "react";
import type { GarmentSide, GarmentType, PrintAreaRect } from "@tshirt/shared-types";
import { MOCKUP_HEIGHT, MOCKUP_WIDTH } from "@tshirt/shared-types";
import { GarmentMockup } from "./index.js";

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move";

const MIN_SIZE = 20;
const PREVIEW_SCALE = 2.2;

function clampRect(rect: PrintAreaRect): PrintAreaRect {
  const width = Math.max(MIN_SIZE, Math.min(rect.width, MOCKUP_WIDTH));
  const height = Math.max(MIN_SIZE, Math.min(rect.height, MOCKUP_HEIGHT));
  const x = Math.max(0, Math.min(rect.x, MOCKUP_WIDTH - width));
  const y = Math.max(0, Math.min(rect.y, MOCKUP_HEIGHT - height));
  return { x, y, width, height };
}

interface PrintAreaEditorProps {
  garmentType: GarmentType;
  side: GarmentSide;
  rect: PrintAreaRect;
  onChange: (rect: PrintAreaRect) => void;
}

/**
 * Interactive mockup preview for tuning the printable rectangle — drag the
 * zone body to reposition, pull handles to resize. Coordinates are in the
 * shared 300×340 viewBox space used by the kiosk editor.
 */
export function PrintAreaEditor({ garmentType, side, rect, onChange }: PrintAreaEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    startRect: PrintAreaRect;
  } | null>(null);

  const [liveRect, setLiveRect] = useState(rect);
  useEffect(() => setLiveRect(rect), [rect]);

  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const bounds = el.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * MOCKUP_WIDTH;
    const y = ((clientY - bounds.top) / bounds.height) * MOCKUP_HEIGHT;
    return { x, y };
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const point = toViewBox(event.clientX, event.clientY);
      const dx = point.x - drag.startX;
      const dy = point.y - drag.startY;
      const start = drag.startRect;
      let next = { ...start };

      switch (drag.handle) {
        case "move":
          next = { ...start, x: start.x + dx, y: start.y + dy };
          break;
        case "n":
          next = { x: start.x, y: start.y + dy, width: start.width, height: start.height - dy };
          break;
        case "s":
          next = { ...start, height: start.height + dy };
          break;
        case "e":
          next = { ...start, width: start.width + dx };
          break;
        case "w":
          next = { x: start.x + dx, y: start.y, width: start.width - dx, height: start.height };
          break;
        case "ne":
          next = { x: start.x, y: start.y + dy, width: start.width + dx, height: start.height - dy };
          break;
        case "nw":
          next = { x: start.x + dx, y: start.y + dy, width: start.width - dx, height: start.height - dy };
          break;
        case "se":
          next = { ...start, width: start.width + dx, height: start.height + dy };
          break;
        case "sw":
          next = { x: start.x + dx, y: start.y, width: start.width - dx, height: start.height + dy };
          break;
      }

      if (next.width < MIN_SIZE) {
        if (drag.handle.includes("w")) next.x = start.x + start.width - MIN_SIZE;
        next.width = MIN_SIZE;
      }
      if (next.height < MIN_SIZE) {
        if (drag.handle.includes("n")) next.y = start.y + start.height - MIN_SIZE;
        next.height = MIN_SIZE;
      }

      setLiveRect(clampRect(next));
    }

    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setLiveRect((current) => {
        const clamped = clampRect(current);
        onChange(clamped);
        return clamped;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onChange, toViewBox]);

  function startDrag(handle: ResizeHandle, event: React.PointerEvent) {
    event.preventDefault();
    const point = toViewBox(event.clientX, event.clientY);
    dragRef.current = { handle, startX: point.x, startY: point.y, startRect: liveRect };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  const previewWidth = MOCKUP_WIDTH * PREVIEW_SCALE;
  const previewHeight = MOCKUP_HEIGHT * PREVIEW_SCALE;
  const zoneStyle = {
    left: liveRect.x * PREVIEW_SCALE,
    top: liveRect.y * PREVIEW_SCALE,
    width: liveRect.width * PREVIEW_SCALE,
    height: liveRect.height * PREVIEW_SCALE,
  };

  const handles: { id: ResizeHandle; className: string; cursor: string }[] = [
    { id: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
    { id: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
    { id: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
    { id: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
    { id: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
    { id: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
    { id: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
    { id: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          width: previewWidth,
          height: previewHeight,
          backgroundColor: "var(--operator-page-bg)",
          border: "1px solid var(--operator-card-border)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        }}
      >
        <GarmentMockup
          garmentType={garmentType}
          side={side}
          color="#ffffff"
          className="absolute inset-0 h-full w-full"
        />

        {/* Dimmed mask outside the printable zone */}
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: "rgba(5,6,10,0.55)" }} />
        <div
          className="pointer-events-none absolute"
          style={{
            ...zoneStyle,
            boxShadow: "0 0 0 9999px rgba(5,6,10,0.55)",
            borderRadius: 2,
          }}
        />

        {/* Interactive zone */}
        <div
          className="absolute touch-none"
          style={zoneStyle}
          onPointerDown={(event) => startDrag("move", event)}
        >
          <div
            className="absolute inset-0 rounded-sm"
            style={{
              border: "2px dashed var(--operator-accent)",
              backgroundColor: "var(--operator-accent-soft)",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: "var(--operator-accent)" }}
          >
            Зона печати
          </div>

          {handles.map((handle) => (
            <button
              key={handle.id}
              type="button"
              aria-label={handle.id}
              className={`absolute h-3.5 w-3.5 rounded-full border-2 border-white ${handle.className}`}
              style={{ backgroundColor: "var(--operator-accent)", cursor: handle.cursor }}
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag(handle.id, event);
              }}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-xs" style={{ color: "var(--operator-text-muted)" }}>
        Перетащите зону или потяните за углы · {Math.round(liveRect.width)}×{Math.round(liveRect.height)} ед.
      </p>
    </div>
  );
}
