/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--light-gray)",
          foreground: "var(--foreground)",
        },
        muted: {
          DEFAULT: "var(--light-gray)",
          foreground: "var(--text-secondary)",
        },
        border: "var(--border)",
        destructive: {
          DEFAULT: "var(--error)",
          foreground: "#ffffff",
        },
        "bloom-orange-glow": "#FF8C42",
      },
    },
  },
  plugins: [],
};

