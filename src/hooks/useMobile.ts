import React, { useEffect, useState } from 'react';

// Mobile detection hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Touch gesture hook for swipe navigation
export function useSwipeGesture(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}

// Pull to refresh hook
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startY || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0 && window.scrollY === 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance * 0.5, 80)); // Limit pull distance
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    setStartY(null);
  };

  return {
    isRefreshing,
    pullDistance,
    handlers: { handleTouchStart, handleTouchMove, handleTouchEnd }
  };
}

// Mobile performance optimizations
export function useMobileOptimizations() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    // Disable hover effects on touch devices
    const style = document.createElement('style');
    style.textContent = `
      @media (hover: none) and (pointer: coarse) {
        .hover\\:bg-accent-primary:hover {
          background-color: transparent !important;
        }
        .hover\\:scale-105:hover {
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    // Optimize scrolling performance
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.head.removeChild(style);
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [isMobile]);

  return { isMobile };
}

// Network-aware image optimization
export function useNetworkAwareImage() {
  const [connection, setConnection] = useState<any>(null);

  useEffect(() => {
    // Check network information
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      setConnection(conn);

      const updateConnection = () => setConnection(conn);
      conn.addEventListener('change', updateConnection);
      return () => conn.removeEventListener('change', updateConnection);
    }
  }, []);

  const getOptimalImageSize = (baseUrl: string, originalSize: string) => {
    if (!connection) return `${baseUrl}${originalSize}`;

    const { effectiveType, downlink } = connection;

    // Reduce image quality on slow connections
    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
      return `${baseUrl}small`; // Use smallest version
    } else if (effectiveType === '3g' || downlink < 2) {
      return `${baseUrl}medium`; // Use medium version
    }

    return `${baseUrl}${originalSize}`; // Use full size
  };

  return { connection, getOptimalImageSize };
}

// Mobile-specific performance optimizations
export function useMobilePerformance() {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    // Reduce motion for better performance
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--transition-duration', '0s');
    }

    // Optimize for mobile viewport
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }

    // Note: Removed preload for root route as it's not necessary for SPA

    return () => {
      if (prefersReducedMotion) {
        document.documentElement.style.removeProperty('--transition-duration');
      }
    };
  }, [isMobile]);

  return { isMobile };
}
