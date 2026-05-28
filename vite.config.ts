import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

/**
 * Build-time secret-leak guard.
 *
 * Vite inlines every `VITE_*`-prefixed env var into the client bundle. If
 * anyone ever re-adds `VITE_REGOLO_API_KEY`, `VITE_OPENROUTER_API_KEY`,
 * `VITE_STRIPE_SECRET_*`, `VITE_SUPABASE_SERVICE_*`, or `VITE_GMAIL_*` to
 * `.env`, the prod build silently leaks the secret to every visitor's
 * DevTools. This loop fails the build instead — visible CI signal.
 */
function assertNoLeakedSecrets(env: Record<string, string>): void {
  const banned = [
    /^VITE_REGOLO_API_KEY$/,
    /^VITE_OPENROUTER_API_KEY$/,
    /^VITE_STRIPE_SECRET/,
    /^VITE_SUPABASE_SERVICE/,
    /^VITE_GMAIL_/,
    /^VITE_SENTRY_AUTH_TOKEN$/,
  ];
  const found = Object.keys(env).filter((k) => banned.some((re) => re.test(k)));
  if (found.length > 0) {
    throw new Error(
      `Refusing to build: ${found.join(', ')} would be inlined into the ` +
        `client bundle. Drop the VITE_ prefix or remove the variable.`,
    );
  }
}

export default defineConfig(({ mode }) => {
  // Run the leak guard against the merged env Vite would actually inline.
  assertNoLeakedSecrets(loadEnv(mode, process.cwd(), 'VITE_'));

  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), './src')
    }
  },
  // @ts-expect-error vitest config is read from vite config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
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
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'animation-vendor': ['motion'],
          'ui-vendor': ['lucide-react', '@tanstack/react-query', 'sonner', 'clsx', 'tailwind-merge'],
          'charts-vendor': ['recharts'],
          // html2canvas and html-to-image are dynamically imported at the call site,
          // so they get their own auto-generated chunks. Don't list them here.
          'image-vendor': ['browser-image-compression'],
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
  };
});
