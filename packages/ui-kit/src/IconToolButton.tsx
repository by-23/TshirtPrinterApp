import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export interface IconToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
}

/**
 * Vertical icon + label button used in the editor's left tool rail
 * (`docs/ui-mockups/editor.png`): dark idle card, pink glow when active.
 * Size/radius/colors read from `--editor-rail-*` CSS custom properties so
 * the in-app EditorThemePanel can retune the whole rail live.
 */
export function IconToolButton({
  icon,
  label,
  active = false,
  className = "",
  disabled,
  style,
  ...rest
}: IconToolButtonProps) {
  const buttonStyle: CSSProperties = {
    height: "var(--editor-rail-btn-height)",
    borderRadius: "var(--editor-rail-btn-radius)",
    backgroundColor: active ? "var(--editor-rail-active-bg)" : "var(--editor-rail-idle-bg)",
    color: active ? "#ffffff" : "var(--editor-rail-idle-text)",
    ...style,
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      style={buttonStyle}
      className={`flex w-full flex-col items-center gap-1.5 px-2 py-4 text-center font-semibold uppercase leading-tight tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? "shadow-neon-pink" : "hover:brightness-125"
      } ${className}`}
      {...rest}
    >
      <span
        className="flex items-center justify-center leading-none"
        style={{
          width: "calc(var(--editor-rail-icon-size) * 1.25)",
          height: "calc(var(--editor-rail-icon-size) * 1.25)",
          fontSize: "var(--editor-rail-icon-size)",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: "var(--editor-rail-label-size)", lineHeight: 1.1 }}>{label}</span>
    </button>
  );
}
