/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-kit/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark navy/near-black surfaces used across all kiosk mockups.
        ink: {
          950: "#05060f",
          900: "#0b0f1e",
          800: "#131a2e",
          700: "#1b2440",
          600: "#26325a",
          400: "#5b6690",
          200: "#a7b0d0",
        },
        // Neon accent palette matching the reference mockups' category/button colors.
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
