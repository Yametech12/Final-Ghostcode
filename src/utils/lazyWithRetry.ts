import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that handles chunk load failures.
 * When a chunk fails to load (e.g., due to a new deployment), it forces a page reload.
 */
export function lazyWithRetry(componentImport: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Log the error before refreshing
        console.error('Chunk load failed. Force refreshing page...', error);
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return { default: () => null } as any; // Return a dummy component while reloading
      }

      // If we already refreshed and it still fails, throw the error
      console.error('Chunk load failed even after refresh:', error);
      throw error;
    }
  });
}
