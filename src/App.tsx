
import { ReactLenis } from 'lenis/react';
import { MotionConfig } from 'motion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/layout/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
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
              </ReactLenis>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
