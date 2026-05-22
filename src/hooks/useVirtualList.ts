import { useEffect, useRef, useState, useMemo, RefObject } from 'react';

/**
 * Lightweight virtualization hook — only renders items visible in the viewport
 * plus a small buffer above/below. Avoids react-window dependency.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null);
 *   const { visibleItems, totalHeight, offsetY } = useVirtualList(items, {
 *     itemHeight: 100,
 *     containerRef,
 *     overscan: 3,
 *   });
 *
 *   <div ref={containerRef} style={{ height: 600, overflow: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       <div style={{ transform: `translateY(${offsetY}px)` }}>
 *         {visibleItems.map(item => <Card key={item.id} {...item} />)}
 *       </div>
 *     </div>
 *   </div>
 */
export interface VirtualListOptions {
  itemHeight: number;
  containerRef: RefObject<HTMLElement | null>;
  overscan?: number;
}

export function useVirtualList<T>(
  items: T[],
  options: VirtualListOptions
) {
  const { itemHeight, containerRef, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    const updateHeight = () => {
      setContainerHeight(el.clientHeight || 600);
    };

    updateHeight();
    el.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    return {
      visibleItems,
      totalHeight,
      offsetY,
      startIndex,
      endIndex,
    };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);
}

/**
 * Hook to lazily render items as they scroll into view.
 * Lighter alternative to full virtualization — just defers off-screen renders.
 */
export function useLazyRender<T extends { id?: string | number }>(
  items: T[],
  initialCount = 20
) {
  const [renderedCount, setRenderedCount] = useState(initialCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || renderedCount >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderedCount(prev => Math.min(prev + 20, items.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, renderedCount]);

  return {
    renderedItems: items.slice(0, renderedCount),
    sentinelRef,
    hasMore: renderedCount < items.length,
  };
}
