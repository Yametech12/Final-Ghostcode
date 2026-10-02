import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

/**
 * Fires a page_view analytics event on every route change.
 * Render once inside the Router (see AnimatedRoutes).
 */
export default function PageTracker(): null {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  return null;
}
