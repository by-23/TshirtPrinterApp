import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";

interface Position {
  x: number;
  y: number;
}

const EDGE_MARGIN = 12;

function clampPosition(pos: Position, size: { width: number; height: number }): Position {
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - size.width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - size.height - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(pos.x, EDGE_MARGIN), maxX),
    y: Math.min(Math.max(pos.y, EDGE_MARGIN), maxY),
  };
}

function loadPosition(storageKey: string): Position | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") return { x: parsed.x, y: parsed.y };
  } catch {
    // ignore malformed storage
  }
  return null;
}

/**
 * Makes a `position: fixed` panel (design/theme panels docked top-right by
 * default) draggable by any element wired to `dragHandleProps`, remembering
 * the last spot per-panel in localStorage. Until the user drags it once, the
 * panel keeps its original CSS-class position (top-right, etc.) — `style`
 * only carries `left`/`top` overrides after a drag.
 */
export function useDraggablePanel(storageKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(() => loadPosition(storageKey));
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const el = containerRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;
    const rect = el.getBoundingClientRect();
    const next = clampPosition(
      { x: event.clientX - drag.offsetX, y: event.clientY - drag.offsetY },
      { width: rect.width, height: rect.height },
    );
    setPosition(next);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setPosition((prev) => {
        if (prev) {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify(prev));
          } catch {
            // ignore quota errors
          }
        }
        return prev;
      });
    },
    [storageKey],
  );

  // Keep the panel on-screen if the window shrinks (e.g. DevTools toggled).
  useEffect(() => {
    function handleResize() {
      const el = containerRef.current;
      setPosition((prev) => (prev && el ? clampPosition(prev, el.getBoundingClientRect()) : prev));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
    : undefined;

  return {
    containerRef,
    style,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
    resetPosition: () => {
      dragRef.current = null;
      setPosition(null);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    },
  };
}
