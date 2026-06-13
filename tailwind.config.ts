import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#0c1117",
        panel: "#111923",
        line: "#233142",
        muted: "#8b9aad",
        accent: "#4fb5c8",
        warning: "#e6a23c",
        danger: "#e05d5d",
        success: "#5dbb86"
      },
      boxShadow: {
        insetGrid: "inset 0 0 0 1px rgba(130, 170, 190, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
