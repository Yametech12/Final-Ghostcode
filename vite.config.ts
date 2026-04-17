import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  // Get API key from environment with fallbacks
  const getApiKey = () => {
    return (
      process.env.OPENROUTER_API_KEY ||
      env.OPENROUTER_API_KEY ||
      ''
    );
  };

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        },
        includeAssets: ['favicon.ico'],
        manifest: false // Disable manifest until icons are ready
      })
    ],
    define: {
      'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(getApiKey()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
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
        overlay: false // Disable error overlay for faster development
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
            // Core React and routing
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],

            // Animation libraries
            'animation-vendor': ['motion'],

            // UI libraries
            'ui-vendor': ['lucide-react', '@tanstack/react-query', 'sonner', 'clsx', 'tailwind-merge'],

            // Charts and data visualization
            'charts-vendor': ['recharts'],

            // Image processing
            'image-vendor': ['browser-image-compression', 'html2canvas', 'html2pdf.js'],

            // Utility libraries
            'utils-vendor': ['lenis'],
          },
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
              : 'chunk';
            return `assets/${facadeModuleId}-[hash].js`;
          },
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable source maps for better debugging
      sourcemap: false,
      // Minimize bundle size
      minify: 'esbuild',
      // Optimize CSS
      cssMinify: true,
    },
    // Optimize development server
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
      ],
      exclude: ['@vite/client', '@vite/env']
    },
  };
});