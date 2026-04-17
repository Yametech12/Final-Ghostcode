import React, { useState, useRef, useMemo } from 'react';
import { cn } from '../lib/utils';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  className,
  overscan = 5
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    return {
      start: Math.max(0, start - overscan),
      end
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      originalIndex: visibleRange.start + index
    }));
  }, [items, visibleRange]);

  // Calculate offset for positioning
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map(({ item, originalIndex }) => (
            <div
              key={originalIndex}
              style={{ height: itemHeight }}
              className="flex items-center"
            >
              {renderItem(item, originalIndex)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for dynamic item height measurement
export function useDynamicVirtualization<T>(
  items: T[],
  estimateSize: (index: number) => number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredSizes, setMeasuredSizes] = useState<Map<number, number>>(new Map());

  // Calculate total height with measured sizes
  const totalHeight = useMemo(() => {
    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += measuredSizes.get(i) ?? estimateSize(i);
    }
    return height;
  }, [items.length, measuredSizes, estimateSize]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    let currentHeight = 0;
    let start = 0;
    let end = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const itemHeight = measuredSizes.get(i) ?? estimateSize(i);
      if (currentHeight + itemHeight > scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      currentHeight += itemHeight;
    }

    // Find end index
    let visibleHeight = 0;
    for (let i = start; i < items.length; i++) {
      const itemHeight = measuredSizes.get(i) ?? estimateSize(i);
      visibleHeight += itemHeight;
      if (visibleHeight > containerHeight + overscan * estimateSize(i)) {
        end = i + 1;
        break;
      }
    }

    return { start, end: Math.min(end, items.length) };
  }, [scrollTop, containerHeight, items.length, measuredSizes, estimateSize, overscan]);

  // Calculate offset
  const offsetY = useMemo(() => {
    let height = 0;
    for (let i = 0; i < visibleRange.start; i++) {
      height += measuredSizes.get(i) ?? estimateSize(i);
    }
    return height;
  }, [visibleRange.start, measuredSizes, estimateSize]);

  const measureElement = (index: number, height: number) => {
    setMeasuredSizes(prev => new Map(prev.set(index, height)));
  };

  return {
    visibleRange,
    offsetY,
    totalHeight,
    scrollTop,
    setScrollTop,
    measureElement
  };
}