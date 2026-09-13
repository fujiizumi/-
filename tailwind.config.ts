import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
        accent: "#2563eb",
        rise: "#059669",
        fall: "#dc2626",
      },
    },
  },
  plugins: [],
};
export default config;
