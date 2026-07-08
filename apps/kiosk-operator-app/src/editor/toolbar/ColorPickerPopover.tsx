import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";
import { useTranslation } from "react-i18next";
import { Palette } from "../../components/icons.js";

export interface ColorPickerPopoverProps {
  color: string;
  onChange: (color: string) => void;
  /** Extra class for the trigger button — callers size/shape it to match nearby swatches. */
  triggerClassName?: string;
}

/**
 * Touch-friendly "any color" picker — a small trigger button (paints itself
 * in the current color) that opens a floating `react-colorful` panel on top
 * of everything else via a portal, since it's used from inside narrow
 * `ToolRail` popovers (`w-64`) that would otherwise clip a full SV square.
 */
export function ColorPickerPopover({ color, onChange, triggerClassName = "" }: ColorPickerPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPosition({ left: rect.left, top: rect.bottom + 8 });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
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
              className="fixed z-[999] flex flex-col gap-2 rounded-2xl border border-ink-600 bg-ink-900 p-3 shadow-xl"
              style={{ left: position.left, top: position.top }}
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
            document.body,
          )
        : null}
    </>
  );
}
