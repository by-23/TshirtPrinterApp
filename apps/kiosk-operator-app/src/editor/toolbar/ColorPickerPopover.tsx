import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";
import { useTranslation } from "react-i18next";
import { Palette } from "../../components/icons.js";
import { getKioskOverlayRoot } from "../../lib/kioskOverlayPortal.js";

export interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  /** Extra class for the trigger button — callers size/shape it to match nearby swatches. */
  triggerClassName?: string;
}

/**
 * Touch-friendly "any color" picker — a small trigger button that opens a
 * floating `react-colorful` panel via the kiosk overlay root (inside the
 * scaled frame), so it is not clipped by narrow tool popovers and stays
 * aligned with the kiosk transform.
 */
export function ColorPickerPopover({ color, onChange, triggerClassName = "" }: ColorPickerPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const overlay = getKioskOverlayRoot();
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const scale = overlay.offsetWidth > 0 ? overlayRect.width / overlay.offsetWidth : 1;
    setPosition({
      left: (triggerRect.left - overlayRect.left) / scale,
      top: (triggerRect.bottom - overlayRect.top) / scale + 8,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-pressed={open}
        title={t("editor.toolbar.moreColors")}
        className={`editor-tool-swatch flex flex-shrink-0 items-center justify-center rounded-full border-2 border-ink-600 bg-[conic-gradient(from_0deg,red,yellow,lime,cyan,blue,magenta,red)] text-white transition-transform hover:scale-105 ${triggerClassName}`}
      >
        <Palette aria-hidden className="h-[55%] w-[55%] drop-shadow" strokeWidth={2.2} />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              data-editor-tool-ui
              className="pointer-events-auto absolute z-[999] flex flex-col gap-2 rounded-2xl border border-ink-600 bg-ink-900 p-3 shadow-xl"
              style={{ left: position.left, top: position.top }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <HexColorPicker color={color} onChange={onChange} className="!h-56 !w-56" />
              <div className="flex items-center gap-2">
                <span className="editor-tool-swatch flex-shrink-0 rounded-full border border-ink-600" style={{ backgroundColor: color }} />
                <input
                  type="text"
                  value={color}
                  onChange={(event) => onChange(event.target.value)}
                  className="editor-tool-caption w-full rounded-lg bg-ink-800 px-3 py-2 text-white focus:outline-none"
                />
              </div>
            </div>,
            getKioskOverlayRoot(),
          )
        : null}
    </>
  );
}
