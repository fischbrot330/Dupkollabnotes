/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base:     "#0c0e14",
          surface:  "#12151f",
          elevated: "#181c28",
          hover:    "#1e2335",
          active:   "#252b40",
        },
        accent: {
          DEFAULT:    "#6366f1",
          hover:      "#4f46e5",
          muted:      "#1e1b4b",
          foreground: "#ffffff",
        },
        border: {
          DEFAULT: "#252b40",
          strong:  "#374060",
        },
        text: {
          primary:   "#e2e8f0",
          secondary: "#94a3b8",
          muted:     "#64748b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.15s ease-out",
        "slide-up": "slideUp 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
