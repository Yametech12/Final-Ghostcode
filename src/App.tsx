
import { ReactLenis } from 'lenis/react';
import { QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/layout/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import AnimatedRoutes from './components/layout/AnimatedRoutes';
import { Suspense } from 'react';
import { queryClient } from './lib/queryClient';
import { useRoutePreloading } from './hooks/useRoutePreloading';
import { LoadingScreen } from './components/LoadingComponents';
import { EnvironmentDebug } from './components/EnvironmentDebug';

function AppContent() {
  useRoutePreloading();

  return (
    <>
      <AnimatedRoutes />
      <EnvironmentDebug />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ReactLenis root options={{ lerp: 0.1, duration: 1.5, smoothWheel: true }}>
            <ScrollToTop />
            <Suspense fallback={<LoadingScreen />}>
              <AppContent />
            </Suspense>
          </ReactLenis>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
