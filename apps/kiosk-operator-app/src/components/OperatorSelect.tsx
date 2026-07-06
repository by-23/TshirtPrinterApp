import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface OperatorSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}

const triggerStyle: CSSProperties = {
  fontSize: "var(--operator-printer-select-font-size)",
  padding: "var(--operator-printer-select-padding-y) var(--operator-printer-select-padding-x)",
  backgroundColor: "var(--operator-page-bg)",
  border: "1px solid var(--operator-card-border)",
};

/**
 * Styled dropdown for the operator printer panel. Native `<select>` option lists
 * ignore font-size on Windows, so we render a custom menu via portal.
 */
export function OperatorSelect({ value, onChange, options }: OperatorSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // OperatorFrame scales the UI with CSS transform; the menu is portaled to
    // body (outside that transform), so we re-apply the same scale here.
    const scale = trigger.offsetHeight > 0 ? rect.height / trigger.offsetHeight : 1;
    const computed = getComputedStyle(trigger);
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4 * scale,
      left: rect.left,
      width: rect.width / scale,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      zIndex: 10000,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  const menu = open
    ? createPortal(
        <ul
          ref={menuRef}
          role="listbox"
          className="overflow-hidden rounded-lg border shadow-lg"
          style={{
            ...menuStyle,
            backgroundColor: "var(--operator-page-bg)",
            borderColor: "var(--operator-card-border)",
          }}
        >
          {options.map((option) => {
            const selected = option === value;
            return (
              <li key={option} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className="flex w-full items-center text-left text-white transition-colors hover:bg-white/10"
                  style={{
                    minHeight: triggerRef.current?.offsetHeight,
                    padding: "var(--operator-printer-select-padding-y) var(--operator-printer-select-padding-x)",
                    fontSize: "inherit",
                    fontWeight: selected ? 600 : 400,
                    backgroundColor: selected ? "color-mix(in srgb, var(--operator-accent) 20%, transparent)" : undefined,
                  }}
                >
                  {option}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg text-white"
        style={triggerStyle}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className="ml-2 h-[1em] w-[1em] flex-shrink-0 opacity-70 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      {menu}
    </>
  );
}
