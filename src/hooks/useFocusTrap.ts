import { useEffect, useRef } from 'react';

/**
 * Traps Tab/Shift-Tab navigation inside `containerRef.current` while `active`.
 * Also wires Escape → onEscape and restores focus to the previously focused
 * element on unmount.
 *
 * Usage:
 *   const containerRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
 *   return <div ref={containerRef} ...>...</div>
 *
 * Why a custom hook instead of @react-aria/focus or focus-trap-react: those
 * pull ~30KB+ for a feature we need on a handful of modals. This is ~50 lines.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable child (or the container itself).
    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(','),
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden'));

    const initial = focusables();
    if (initial.length > 0) {
      initial[0].focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const list = focusables();
      if (list.length === 0) {
        e.preventDefault();
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey && activeEl === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to the trigger element so screen readers and keyboard
      // users land back where they were before the modal opened.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try {
          previouslyFocused.focus();
        } catch {
          // ignore — element may have been removed from DOM
        }
      }
    };
  }, [active, onEscape]);

  return ref;
}
