import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

/**
 * Placeholder for a shared touch-friendly button used across the kiosk UI.
 * Will grow with real styling/variants once the editor (Stage 2) starts.
 */
export function TouchButton({ children, ...rest }: TouchButtonProps) {
  return <button {...rest}>{children}</button>;
}
