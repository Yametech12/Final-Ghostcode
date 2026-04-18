import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { toast } from 'sonner';

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'ghost';
  className?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

export default function LogoutButton({
  variant = 'default',
  className = '',
  onSuccess,
  onError,
  children
}: LogoutButtonProps) {
  const { signOut } = useEnhancedAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      onSuccess?.();
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out. Please try again.');
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const variantClasses = {
    default: 'bg-white/10 hover:bg-white/20 text-white',
    destructive: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/20',
    ghost: 'hover:bg-white/5 text-slate-300'
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${variantClasses[variant]} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      {children || 'Sign Out'}
    </button>
  );
}