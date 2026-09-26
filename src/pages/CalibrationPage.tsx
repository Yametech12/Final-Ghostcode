/**
 * Backwards-compatible re-export.
 * The Calibration page has been refactored into the feature folder
 * `src/features/calibration/`. The React Router lazy import
 * (src/components/layout/AnimatedRoutes.tsx) and the route-preloading
 * map (src/hooks/useRoutePreloading.ts) still resolve this module path,
 * so we keep it as a stable default re-export.
 */
export { default } from '../features/calibration/CalibrationPage';
