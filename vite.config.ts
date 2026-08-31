import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    hmr: { host: 'localhost', port: 5174, protocol: 'ws' },
    port: 5174,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    sourcemap: false,
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) return 'vendor-react';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory') || id.includes('node_modules/internmap') || id.includes('node_modules/decimal.js')) return 'vendor-charts';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/')) return 'vendor-other';
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
