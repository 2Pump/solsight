import type { Config } from "tailwindcss";

// SolSight design tokens
// Palette: deep indigo-black base, electric violet + signal teal duotone,
// coral used only for risk/danger — deliberately not the standard green/red trading look.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // Base surfaces
        void: "#08070D",       // page background
        abyss: "#0E0D16",      // section background
        surface: "#15141F",    // card background
        "surface-2": "#1C1B29", // elevated card / hover
        border: "rgba(255,255,255,0.08)",
        "border-strong": "rgba(255,255,255,0.14)",

        // Text
        ink: "#F3F2F8",
        "ink-muted": "#9997A8",
        "ink-faint": "#65637A",

        // Signature accents
        signal: {
          DEFAULT: "#7C5CFF", // electric violet — primary brand
          soft: "#A48CFF",
          dim: "#4B3B99",
        },
        pulse: {
          DEFAULT: "#00E5C7", // signal teal — positive / confirm
          soft: "#5FF3DD",
        },
        risk: {
          DEFAULT: "#FF5C7A", // coral — danger / rug risk, not classic trading red
          soft: "#FF8FA3",
        },
        amber: {
          DEFAULT: "#FFB454", // caution
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
      backgroundImage: {
        "radar-gradient":
          "radial-gradient(circle at 50% 50%, rgba(124,92,255,0.18) 0%, rgba(124,92,255,0.05) 35%, transparent 70%)",
        "grid-glow":
          "linear-gradient(rgba(124,92,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(124,92,255,0.06) 1px, transparent 1px)",
        "aurora":
          "linear-gradient(135deg, rgba(124,92,255,0.25), rgba(0,229,199,0.12) 45%, transparent 70%)",
      },
      keyframes: {
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "80%": { opacity: "0" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "radar-sweep": "radar-sweep 6s linear infinite",
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.2,0.6,0.4,1) infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
