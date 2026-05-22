import { useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Map of route paths to their lazy import functions
// This enables hover-based prefetching across the app
const ROUTE_IMPORTS: Record<string, () => Promise<any>> = {
  '/': () => import('../pages/HomePage'),
  '/profile': () => import('../pages/ProfilePage'),
  '/advisor': () => import('../pages/AdvisorPage'),
  '/assessment': () => import('../pages/AssessmentPage'),
  '/assessment-result': () => import('../pages/AssessmentResultPage'),
  '/calibration': () => import('../pages/CalibrationPage'),
  '/profiler': () => import('../pages/ProfilerPage'),
  '/quiz': () => import('../pages/QuizPage'),
  '/compare': () => import('../pages/ComparePage'),
  '/simulation': () => import('../pages/SimulationPage'),
  '/decryptor': () => import('../pages/DecryptorPage'),
  '/encyclopedia': () => import('../pages/EncyclopediaPage'),
  '/guide': () => import('../pages/GuidePage'),
  '/field-guide': () => import('../pages/FieldGuidePage'),
  '/glossary': () => import('../pages/GlossaryPage'),
  '/quick-reference': () => import('../pages/QuickReferencePage'),
  '/favorites': () => import('../pages/FavoritesPage'),
  '/dossiers': () => import('../pages/DossiersPage'),
  '/insights': () => import('../pages/InsightsPage'),
  '/admin': () => import('../pages/AdminDashboard'),
};

// Track which routes have already been prefetched to avoid duplicate work
const prefetched = new Set<string>();

/**
 * Prefetch a route's chunk. Called on link hover.
 * Idempotent — safe to call multiple times.
 */
export function prefetchRoute(path: string): void {
  // Strip query strings and hashes
  const cleanPath = path.split('?')[0].split('#')[0];
  const importer = ROUTE_IMPORTS[cleanPath];
  if (!importer || prefetched.has(cleanPath)) return;
  prefetched.add(cleanPath);
  importer().catch(() => {
    // If preload fails, allow it to retry later
    prefetched.delete(cleanPath);
  });
}

/**
 * Hook that returns a hover prefetch handler.
 * Use this on Link components to prefetch routes when users hover.
 *
 * Example:
 *   const prefetch = useHoverPrefetch();
 *   <Link to="/advisor" onMouseEnter={() => prefetch('/advisor')}>Advisor</Link>
 */
export function useHoverPrefetch() {
  return useCallback((path: string) => {
    prefetchRoute(path);
  }, []);
}

/**
 * Auto-preload routes based on user behavior patterns.
 * Triggers route prefetches based on the current location.
 */
export function useRoutePreloading() {
  const location = useLocation();

  useEffect(() => {
    // Use requestIdleCallback so we don't block the main thread
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));

    idle(() => {
      // Always preload core routes after initial paint
      if (location.pathname === '/') {
        prefetchRoute('/profile');
        prefetchRoute('/advisor');
        prefetchRoute('/assessment');
      }

      // Preload tool pages when user is in core areas
      if (['/profile', '/advisor', '/assessment'].includes(location.pathname)) {
        prefetchRoute('/calibration');
        prefetchRoute('/profiler');
        prefetchRoute('/quiz');
      }

      // Preload reference pages when user shows interest in learning
      if (['/guide', '/encyclopedia'].includes(location.pathname)) {
        prefetchRoute('/field-guide');
        prefetchRoute('/glossary');
      }
    });
  }, [location.pathname]);
}

// Intersection Observer for component-level preloading
export function useIntersectionPreload(
  ref: React.RefObject<Element>,
  componentImport: () => Promise<any>
) {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            componentImport().catch(console.error);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, componentImport]);
}
