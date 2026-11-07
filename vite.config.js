import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split the bundle so users only download what they need on the first page.
    // Vendor libraries (React, Supabase) are cached separately from app code,
    // so a code change doesn't bust the React/Supabase cache for returning users.
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached aggressively, almost never changes
          'vendor-react': ['react', 'react-dom'],
          // Supabase client — large but rarely updated
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
})
