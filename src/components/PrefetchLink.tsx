import { Link, LinkProps } from 'react-router-dom';
import { useHoverPrefetch } from '../hooks/useRoutePreloading';

/**
 * Drop-in replacement for react-router-dom's Link that prefetches the route's
 * chunk when the user hovers over it. Makes navigation feel instant.
 */
export default function PrefetchLink({ to, onMouseEnter, onFocus, ...props }: LinkProps) {
  const prefetch = useHoverPrefetch();
  const path = typeof to === 'string' ? to : to.pathname || '';

  return (
    <Link
      to={to}
      onMouseEnter={(e) => {
        prefetch(path);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch(path);
        onFocus?.(e);
      }}
      {...props}
    />
  );
}
