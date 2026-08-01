import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

export interface DraggableToolPopoverProps {
  children: ReactNode;
  className?: string;
}

/**
 * CSS `transform: scale()` on `KioskFrame` shrinks the rendered box, but
 * `clientX`/`clientY` stay in viewport pixels. Convert a viewport delta into
 * the element's local (pre-scale) coordinate space.
 */
function getRenderedScale(el: HTMLElement): number {
  const width = el.offsetWidth;
  if (width <= 0) return 1;
  return el.getBoundingClientRect().width / width;
}

/**
 * Floating editor tool panel with a top drag handle so the shopper can
 * move it away from the canvas / mockup.
 *
 * Drag writes `transform` on the DOM node directly (native window listeners,
 * no React re-renders) and compensates for the kiosk frame scale so the panel
 * tracks the pointer 1:1.
 */
export function DraggableToolPopover({ children, className = "" }: DraggableToolPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    scale: number;
  } | null>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function flush() {
      rafRef.current = 0;
      const pending = pendingRef.current;
      const el = panelRef.current;
      if (!pending || !el) return;
      pendingRef.current = null;
      offsetRef.current = pending;
      el.style.transform = `translate3d(${pending.x}px, ${pending.y}px, 0)`;
    }

    function onPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const scale = drag.scale || 1;
      pendingRef.current = {
        x: drag.originX + (event.clientX - drag.startX) / scale,
        y: drag.originY + (event.clientY - drag.startY) / scale,
      };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(flush);
      }
    }

    function onPointerUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        offsetRef.current = pending;
        const el = panelRef.current;
        if (el) el.style.transform = `translate3d(${pending.x}px, ${pending.y}px, 0)`;
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const el = panelRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offsetRef.current.x,
      originY: offsetRef.current.y,
      scale: el ? getRenderedScale(el) : 1,
    };
  }

  return (
    <div
      ref={panelRef}
      className={`editor-tool-popover absolute left-full top-0 z-40 ml-4 border border-ink-600 bg-ink-900 shadow-xl ${className}`.trim()}
      style={{ willChange: "transform" }}
    >
      <div className="editor-tool-popover-drag" onPointerDown={handlePointerDown}>
        <span className="editor-tool-popover-drag-grip" aria-hidden />
      </div>
      {children}
    </div>
  );
}
