import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
      },
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: true
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
    },
    hmr: {
      overlay: false
    }
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      plugins: [
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        })
      ],
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'animation-vendor': ['motion'],
          'ui-vendor': ['lucide-react', '@tanstack/react-query', 'sonner', 'clsx', 'tailwind-merge'],
          'charts-vendor': ['recharts'],
          'image-vendor': ['browser-image-compression', 'html2canvas', 'html2pdf.js'],
          'utils-vendor': ['lenis'],
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `assets/${facadeModuleId}-[hash].js`;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
    exclude: ['@vite/client', '@vite/env']
  },
});