import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

/**
 * Vite Configuration for Reliance ERP & Storefront PWA
 *
 * SPA Service Worker & Workbox Architecture:
 * - Workbox Service Worker Generation: Managed via `vite-plugin-pwa` to eliminate conflicting
 *   manual service workers (such as legacy `public/sw.js`).
 * - SPA Fallback Routing Logic:
 *   Configured with `navigateFallback: '/index.html'`. All unknown client-side SPA navigation
 *   requests (such as `/login`, `/system/invoices`, `/system/products`, etc.) are intercepted by Workbox
 *   and served the React app shell (`/index.html`) rather than causing the network fetch promise to fail.
 *   This completely resolves the browser console error:
 *     `TypeError: Failed to convert value to 'Response'`
 *   which happens when a navigation fetch event handler fails to return a valid Response.
 * - API & Dynamic Backend Denylist:
 *   Configured with `navigateFallbackDenylist: [/^\/api/]`. This ensures that all backend API requests
 *   (`/api/*`) bypass the SPA app shell fallback and are routed directly to the backend server.
 */
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // Registered manually with auto-update lifecycle in src/main.tsx
      devOptions: {
        // Disabled in local development to prevent WorkerGlobalScope importScripts / dev-sw.js errors
        enabled: false,
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff2}'],
        globIgnores: ['**/version.json'],
      },
      manifest: {
        short_name: 'Reliance POS',
        name: 'Reliance Clothing ERP & POS Suite',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512x512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          },
        ],
        start_url: '/',
        background_color: '#09090b',
        theme_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
      },
    }),
  ],
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
          const normalized = id.replace(/\\/g, '/');
          if (!normalized.includes('/node_modules/')) return;
          if (
            normalized.includes('/node_modules/react/') ||
            normalized.includes('/node_modules/react-dom/') ||
            normalized.includes('/node_modules/react-router/') ||
            normalized.includes('/node_modules/react-router-dom/') ||
            normalized.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
          if (
            normalized.includes('/node_modules/jspdf/') ||
            normalized.includes('/node_modules/jspdf-autotable/') ||
            normalized.includes('/node_modules/html2canvas/') ||
            normalized.includes('/node_modules/html2pdf.js/')
          ) {
            return 'vendor-pdf';
          }
          if (normalized.includes('/node_modules/@radix-ui/')) {
            return 'vendor-ui';
          }
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
          }
          return 'vendor-core';
        },
      },
    },
    chunkSizeWarningLimit: 1600,
  },
})
