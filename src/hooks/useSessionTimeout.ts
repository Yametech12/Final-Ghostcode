import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/EnhancedAuthContext';

/**
 * Hook to manage automatic session timeout due to inactivity
 * @param timeoutMs - Timeout duration in milliseconds (default: 30 minutes)
 * @param warningBeforeMs - Time before timeout to show warning (default: 2 minutes)
 * @param onWarning - Callback when user should be warned about timeout
 * @param onTimeout - Callback when session has timed out
 */
export function useSessionTimeout(
  timeoutMs: number = 30 * 60 * 1000, // 30 minutes
  warningBeforeMs: number = 2 * 60 * 1000, // 2 minutes
  onWarning?: () => void,
  onTimeout?: () => void
) {
  const { logout, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const activityRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (activityRef.current) {
      clearTimeout(activityRef.current);
      activityRef.current = null;
    }

    if (!user) return;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      onWarning?.();
    }, timeoutMs - warningBeforeMs);

    // Set timeout timer
    timeoutRef.current = setTimeout(async () => {
      try {
        await logout();
        onTimeout?.();
      } catch (err) {
        console.error('Logout on timeout failed:', err);
      }
    }, timeoutMs);
  }, [user, logout, timeoutMs, warningBeforeMs, onWarning, onTimeout]);

  const recordActivity = useCallback(() => {
    // Debounce activity resets
    if (activityRef.current) {
      clearTimeout(activityRef.current);
    }

    activityRef.current = setTimeout(() => {
      resetTimers();
    }, 1000); // Debounce for 1 second
  }, [resetTimers]);

  useEffect(() => {
    if (!user) return;

    // Start timers when user is logged in
    resetTimers();

    // Event listeners for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => recordActivity();

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      // Cleanup
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (activityRef.current) clearTimeout(activityRef.current);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [user, resetTimers, recordActivity]);

  // Return manual reset function for explicit control
  return { recordActivity, resetTimers };
}
