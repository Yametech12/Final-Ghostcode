import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Preload routes based on user behavior patterns
export function useRoutePreloading() {
  const location = useLocation();

  useEffect(() => {
    const preloadRoutes = () => {
      // Preload high-priority routes after initial page load
      setTimeout(() => {
        // Preload core functionality when user is on home page
        if (location.pathname === '/') {
          import('../pages/ProfilesPage');
          import('../pages/AdvisorPage');
          import('../pages/AssessmentPage');
        }

        // Preload tool pages when user is in core areas
        if (['/profiles', '/advisor', '/assessment'].includes(location.pathname)) {
          import('../pages/CalibrationPage');
          import('../pages/ProfilerPage');
          import('../pages/QuizPage');
        }

        // Preload reference pages when user shows interest in learning
        if (['/guide', '/encyclopedia'].includes(location.pathname)) {
          import('../pages/FieldGuidePage');
          import('../pages/GlossaryPage');
        }
      }, 2000); // Delay to prioritize initial page load
    };

    preloadRoutes();
  }, [location.pathname]);
}

// Intersection Observer for component-level preloading
export function useIntersectionPreload(ref: React.RefObject<Element>, componentImport: () => Promise<any>) {
  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Preload component when it comes into view
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
