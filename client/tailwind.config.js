/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // legacy camelCase kept for backward compat
        ludoRed: "#EF4444",
        ludoBlue: "#3B82F6",
        ludoGreen: "#10B981",
        ludoYellow: "#F59E0B",
        // new ludo design-system tokens (kebab-case via nested object)
        ludo: {
          red: "#DC2626",
          green: "#16A34A",
          blue: "#2563EB",
          yellow: "#EAB308",
          track: "#FFF8F0",
          "board-border": "#4B5563",
          "cell-border": "#9CA3AF",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "bounce-slow": "bounce 2s infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
