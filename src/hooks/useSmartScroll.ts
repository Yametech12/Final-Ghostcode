import { useEffect, useRef, useState, useCallback } from 'react';

const NEAR_BOTTOM_PX = 80;

/**
 * Smart auto-scroll for chat-like surfaces.
 *
 * - Auto-scrolls to bottom only when the user is already near the bottom.
 * - Exposes `isAtBottom` so a "scroll to latest" button can be shown.
 * - Triggers when `dep` changes (typically `messages.length` or streaming content length).
 */
export function useSmartScroll<T>(dep: T) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const checkPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distanceFromBottom <= NEAR_BOTTOM_PX);
  }, []);

  // Listen for user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkPosition, { passive: true });
    return () => el.removeEventListener('scroll', checkPosition);
  }, [checkPosition]);

  // Auto-scroll on new content if user is at the bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isAtBottom) return;
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  return { containerRef, isAtBottom, scrollToBottom };
}
