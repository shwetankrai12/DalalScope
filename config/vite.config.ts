import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  plugins: [react()],
  css: {
    postcss: path.resolve(__dirname),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        carousel: path.resolve(__dirname, '../src/main.tsx'),
      },
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`
      }
    }
  },
  define: {
    'process.env': {}
  }
})
