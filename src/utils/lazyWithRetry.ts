import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that handles chunk load failures.
 *
 * When a chunk fails to load (typically because a deploy invalidated the
 * hashed asset URL cached in the user's tab), we force a one-shot page
 * reload to pick up the new bundle. If the reload also fails, the error
 * propagates so the surrounding ErrorBoundary can present it to the user.
 *
 * Previously this function returned `{ default: () => null }` while the
 * reload was in flight, which caused React to briefly mount a blank
 * component — flashing empty UI and firing downstream effects (analytics,
 * page-view counters) for a route that never actually rendered.
 *
 * Throwing a real error instead lets the ErrorBoundary show a proper
 * "updating…" state and avoids the false-render side effects.
 */
class ChunkReloadingError extends Error {
  constructor() {
    super('A new version of the app is loading. Please wait a moment.');
    this.name = 'ChunkReloadingError';
  }
}

export function lazyWithRetry(
  componentImport: () => Promise<{ default: ComponentType<any> }>,
) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false',
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        console.error('Chunk load failed. Force refreshing page...', error);
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        // Schedule the reload but don't return a dummy component — throw so
        // <ErrorBoundary> shows its fallback while the reload races.
        window.location.reload();
        throw new ChunkReloadingError();
      }

      console.error('Chunk load failed even after refresh:', error);
      throw error;
    }
  });
}
