import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Existing backend proxy
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
      // Nominatim reverse geocoding proxy (fixes CORS on localhost)
      // Adds required User-Agent header — Nominatim blocks requests without it
      "/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ""),
        headers: {
          "User-Agent": "RideMateApp/1.0 (contact@ridemate.app)",
          "Accept-Language": "en",
        },
      },
    },
  },
})