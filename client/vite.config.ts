import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Unique per build — lets the app detect "a new deploy was cached" and offer
// a refresh toast (see src/lib/pwa.ts).
const __APP_BUILD_ID__ = JSON.stringify(`v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  define: {
    __APP_BUILD_ID__,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
})
