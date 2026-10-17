import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vite Configuration for Reliance ERP & Storefront PWA
 *
 * PWA & Service Worker Architecture Notes:
 * - Runtime Service Worker: Hosted at `/public/sw.js` and registered in `src/main.tsx`.
 * - Same-Origin Filter: The Service Worker strictly intercepts same-origin requests
 *   (url.origin === self.location.origin) and completely bypasses external third-party origins
 *   (such as Cloudflare Insights / static.cloudflareinsights.com, CDNs, and trackers) to avoid
 *   console FetchEvent network error rejections.
 * - SPA Navigation Fallback: Workbox navigateFallback equivalent is enforced for all navigation
 *   requests (mode === 'navigate'), falling back to `/index.html` for deep links (e.g.,
 *   /system/products, /system/raw-material-shops) with strict denylists for `/api` and `/socket.io/`.
 * - Graceful Error Handling: Intercepted requests safely catch network errors and always return
 *   a valid fallback Response object, preventing 'Failed to convert value to Response' errors.
 */
export default defineConfig({
  base: '/',
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
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) return 'vendor-react';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory') || id.includes('node_modules/internmap') || id.includes('node_modules/decimal.js')) return 'vendor-charts';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
          if (id.includes('node_modules/@radix-ui/')) return 'vendor-ui';
          if (id.includes('node_modules/')) return 'vendor-other';
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
})
