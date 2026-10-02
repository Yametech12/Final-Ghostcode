
import { ReactLenis } from 'lenis/react';
import { MotionConfig } from 'motion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import ScrollToTop from './components/layout/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import AnimatedRoutes from './components/layout/AnimatedRoutes';
import SEO from './components/SEO';
import { Suspense, lazy } from 'react';
import { queryClient } from './lib/queryClient';
import { useRoutePreloading } from './hooks/useRoutePreloading';
import { LoadingScreen } from './components/LoadingComponents';

// Only load EnvironmentDebug in development
const EnvironmentDebug = import.meta.env.DEV
  ? lazy(() => import('./components/EnvironmentDebug').then(m => ({ default: m.EnvironmentDebug })))
  : () => null;

function AppContent() {
  useRoutePreloading();

  return (
    <>
      <SEO />
      <AnimatedRoutes />
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <EnvironmentDebug />
        </Suspense>
      )}
    </>
  );
}

/* Phase 2 — sonner Toaster themed against the luxury palette (Req 9.7).
   Rendered INSIDE ThemeProvider so toast colors follow the light/dark
   toggle. (15x light/dark audit, Oct 2026 — was hardcoded dark in main.tsx.) */
function ThemedToaster() {
  const { isDark } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={isDark ? 'dark' : 'light'}
      richColors={false}
      closeButton
      duration={4000}
      style={{
        // Map sonner's CSS variables to the luxury palette tokens per theme.
        ['--normal-bg' as string]: isDark ? 'rgba(22, 17, 24, 0.95)' : 'rgba(242, 237, 227, 0.95)',
        ['--normal-text' as string]: isDark ? '#F0EBE3' : '#14110E',
        ['--normal-border' as string]: isDark ? 'rgba(232, 199, 126, 0.12)' : 'rgba(184, 134, 11, 0.22)',
        ['--success-bg' as string]: isDark ? 'rgba(22, 17, 24, 0.95)' : 'rgba(242, 237, 227, 0.95)',
        ['--success-text' as string]: isDark ? '#6FA083' : '#3E7A52',
        ['--success-border' as string]: isDark ? 'rgba(111, 160, 131, 0.30)' : 'rgba(62, 122, 82, 0.35)',
        ['--error-bg' as string]: isDark ? 'rgba(22, 17, 24, 0.95)' : 'rgba(242, 237, 227, 0.95)',
        ['--error-text' as string]: isDark ? '#C77A6F' : '#A83A2A',
        ['--error-border' as string]: isDark ? 'rgba(199, 122, 111, 0.40)' : 'rgba(168, 58, 42, 0.35)',
        ['--warning-bg' as string]: isDark ? 'rgba(22, 17, 24, 0.95)' : 'rgba(242, 237, 227, 0.95)',
        ['--warning-text' as string]: isDark ? '#C99B5B' : '#8A5A1D',
        ['--warning-border' as string]: isDark ? 'rgba(201, 155, 91, 0.30)' : 'rgba(138, 90, 29, 0.35)',
        ['--info-bg' as string]: isDark ? 'rgba(22, 17, 24, 0.95)' : 'rgba(242, 237, 227, 0.95)',
        ['--info-text' as string]: isDark ? '#7A93A8' : '#3E6478',
        ['--info-border' as string]: isDark ? 'rgba(122, 147, 168, 0.30)' : 'rgba(62, 100, 120, 0.35)',
      }}
      toastOptions={{
        className:
          'backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] rounded-xl',
      }}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      {/* Honor OS reduced-motion for ALL framer-motion JS animations site-wide */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <ReactLenis root options={{ lerp: 0.1, duration: 1.5, smoothWheel: true }}>
                <a href="#main-content" className="skip-link">
                  Skip to main content
                </a>
                <ScrollToTop />
                <Suspense fallback={<LoadingScreen />}>
                  <AppContent />
                </Suspense>
                <ThemedToaster />
              </ReactLenis>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
