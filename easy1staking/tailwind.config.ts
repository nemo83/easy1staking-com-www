import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-deep": "var(--bg-deep)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          teal: "var(--brand-2)",
          magenta: "var(--brand-3)",
        },
        ink: {
          high: "var(--text-high)",
          mid: "var(--text-mid)",
          low: "var(--text-low)",
          faint: "var(--text-faint)",
        },
      },
      fontFamily: {
        sans: ["var(--f-sans)"],
        mono: ["var(--f-mono)"],
        serif: ["var(--f-serif)"],
      },
      borderRadius: {
        box: "16px",
        "box-sm": "10px",
        "box-lg": "24px",
        pill: "999px",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "grad-signature": "var(--grad-signature)",
        "grad-warm": "var(--grad-warm)",
        "grad-glow": "var(--grad-glow)",
      },
    },
  },
  plugins: [],
};
export default config;
