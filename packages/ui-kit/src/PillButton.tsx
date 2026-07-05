import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active?: boolean;
  icon?: ReactNode;
}

/**
 * Rounded pill toggle used for language/side/size/material switches across
 * the kiosk mockups (dark idle state, pink glow when active).
 */
export function PillButton({ children, active = false, icon, className = "", ...rest }: PillButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-neon-pink text-white shadow-neon-pink"
          : "bg-ink-800 text-ink-200 hover:brightness-125 hover:text-white"
      } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
