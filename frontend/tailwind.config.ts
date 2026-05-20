import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        socBg: "#070b14",
        panel: "#0f1727",
        accent: "#28c7c1",
        danger: "#ff5b6e",
      },
      boxShadow: {
        glow: "0 0 50px rgba(40,199,193,0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
