/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-kit/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: "var(--font-family)",
        display: "var(--font-family)",
      },
      colors: {
        // Dark navy/near-black surfaces used across all kiosk mockups.
        ink: {
          950: "#05060f",
          900: "#0b0f1e",
          800: "#131a2e",
          700: "#1b2440",
          600: "#26325a",
          400: "#5b6690",
          300: "#cac9cb",
          200: "#a7b0d0",
        },
        // NOTE: brand primary/secondary/tertiary + all card corner radii used
        // to live here as static Tailwind tokens. They're now CSS custom
        // properties in `index.css` instead (--brand-primary, --radius-card,
        // etc.) so the in-app Design Panel (ThemePanel.tsx) can retune them
        // live, with components reading them via `style={{ ... }}` or
        // Tailwind arbitrary values like `rounded-[var(--radius-card)]`.
        // Neon accent palette used to color-code catalog categories (kept
        // separate from `brand` since it's a categorization tool, not identity).
        neon: {
          pink: "#ff2d95",
          cyan: "#22d3f5",
          purple: "#8b5cf6",
          teal: "#14b8a6",
          blue: "#2563eb",
          green: "#22c55e",
          yellow: "#eab308",
        },
      },
      borderRadius: {
        // `pill` is the only corner radius still fixed at build time (it's
        // always "fully round" regardless of element size, so there's
        // nothing to tune). Card radii are CSS vars — see the note above.
        pill: "9999px",
      },
      boxShadow: {
        "neon-pink": "0 0 0 1px rgba(255,45,149,0.6), 0 0 20px rgba(255,45,149,0.45)",
        "neon-cyan": "0 0 0 1px rgba(34,211,245,0.6), 0 0 20px rgba(34,211,245,0.4)",
        "neon-purple": "0 0 0 1px rgba(139,92,246,0.6), 0 0 20px rgba(139,92,246,0.4)",
        "neon-teal": "0 0 0 1px rgba(20,184,166,0.6), 0 0 20px rgba(20,184,166,0.4)",
        "neon-blue": "0 0 0 1px rgba(37,99,235,0.6), 0 0 20px rgba(37,99,235,0.4)",
      },
    },
  },
  plugins: [],
};
