import React from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export default function LogoutButton({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  onSuccess,
  onError
}: LogoutButtonProps) {
  const { logout, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (isLoggingOut || loading) return;

    setIsLoggingOut(true);
    try {
      // Attempt normal logout first
      await logout();

      // Force clear everything as backup
      forceClearSession();

      toast.success('Logged out successfully');
      onSuccess?.();

      // Force redirect even if navigation fails
      setTimeout(() => {
        window.location.href = '/login';
      }, 500);

    } catch (error) {
      console.error('Logout failed:', error);

      // Force clear session even if API call failed
      forceClearSession();

      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      toast.error(`Logout completed with issues: ${errorMessage}`);

      onError?.(error instanceof Error ? error : new Error(errorMessage));

      // Still redirect
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Force clear all auth-related data
  const forceClearSession = () => {
    try {
      // Clear Supabase session
      if (window.supabase) {
        window.supabase.auth.signOut({ scope: 'global' });
      }

      // Clear localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          sessionStorage.removeItem(key);
        }
      });

      // Clear cookies (auth-related)
      document.cookie.split(";").forEach(cookie => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name.includes('supabase') || name.includes('auth')) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      });

    } catch (error) {
      console.warn('Force clear session encountered error:', error);
    }
  };

  const baseClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg'
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-md font-medium
        transition-colors focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${baseClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {isLoggingOut ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {children || (isLoggingOut ? 'Logging out...' : 'Logout')}
    </button>
  );
}

// Add supabase to window for force clear (optional)
declare global {
  interface Window {
    supabase?: any;
  }
}