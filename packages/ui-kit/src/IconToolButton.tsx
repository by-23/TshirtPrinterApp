import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

/**
 * Vertical icon + label button used in the editor's left tool rail
 * (`docs/ui-mockups/editor.png`): dark idle card, pink glow when active.
 */
export function IconToolButton({
  icon,
  label,
  active = false,
  className = "",
  disabled,
  ...rest
}: IconToolButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={`flex w-full flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-neon-pink text-white shadow-neon-pink"
          : "bg-ink-800 text-ink-200 hover:bg-ink-700 hover:text-white"
      } ${className}`}
      {...rest}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}
