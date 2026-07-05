import type { SVGProps } from "react";

/**
 * Hand-drawn placeholder glyphs used instead of color emoji for card/banner
 * artwork. Emoji rendering depends on the OS having a color emoji font
 * installed (missing on some Windows setups, showing empty boxes) — plain
 * `currentColor` SVG strokes/fills always render identically everywhere.
 */
type IconProps = SVGProps<SVGSVGElement>;

export function TshirtIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        d="M6.5 5.5 4 8v2.2l2 .8v10h12v-10l2-.8V8l-2.5-2.5-3.2 1.8h-2.6L6.5 5.5z"
        strokeLinejoin="round"
      />
      <path
        d="M9 5.5V3.8c0-.9.7-1.6 1.5-1.6h3c.8 0 1.5.7 1.5 1.6V5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PhotoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
      <path d="M21 16l-5.5-5.5-4 4-3-3L3 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M7 3v6M13 3v6M19 3v6" />
    </svg>
  );
}

export function GamepadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="2" y="7" width="20" height="10" rx="5" />
      <path d="M7 10v4M5 12h4" strokeLinecap="round" />
      <circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BrushIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M15 4l5 5-8.2 8.2a3 3 0 01-1.9.9L6 18.5l.4-3.9a3 3 0 01.9-1.9L15 4z" strokeLinejoin="round" />
      <path d="M4.5 20.5c.8-2.6 2.4-3.6 4-3.6" strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <path d="M12 15.5V4M12 4L8 8M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15.5v3a2 2 0 002 2h11a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RobotIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <rect x="5" y="8" width="14" height="11" rx="2.5" />
      <circle cx="9.5" cy="13.3" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.3" r="1.2" fill="currentColor" stroke="none" />
      <path d="M12 8V4.5" strokeLinecap="round" />
      <circle cx="12" cy="3.2" r="1.1" fill="currentColor" stroke="none" />
      <path d="M2.5 12h2.5M19 12h2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <path
        d="M3 4h2l2.3 12.2a2 2 0 002 1.8h7.3a2 2 0 002-1.8L20 8H6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="20.2" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16.8" cy="20.2" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.6l-5.9 3.4 1.5-6.5-5-4.4 6.6-.6L12 2.5z" />
    </svg>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2c1.2 3-2.8 4.3-2.8 8.2a2.8 2.8 0 005.6 0c0-1.3-.8-1.9-.8-2.9 2 1.2 3.9 4 3.9 6.9a5.9 5.9 0 11-11.8 0C6.1 8.6 9 5.7 12 2z" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13 2L4.5 14h6L9.5 22 19.5 9h-6L13 2z" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M3 8.5l4 2.8L12 5l5 6.3 4-2.8-2 9.5H5l-2-9.5z" />
    </svg>
  );
}

export function SmileyIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 9.5h.01M15.5 9.5h.01" strokeLinecap="round" strokeWidth={2.4} />
      <path d="M7.8 15c1.6 1.6 6.8 1.6 8.4 0" strokeLinecap="round" />
    </svg>
  );
}
