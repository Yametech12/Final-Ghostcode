import { NavLink } from 'react-router-dom';
import { Home, Users, FileText, Shield, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className = '' }: BottomNavProps) {
  const links = [
    { to: '/', icon: Home, label: 'Home', exact: true },
    { to: '/profile', icon: Users, label: 'Profile', exact: false },
    { to: '/dossiers', icon: FileText, label: 'Dossiers', exact: false },
    { to: '/advisor', icon: Shield, label: 'Advisor', exact: false },
    { to: '/calibrate', icon: Target, label: 'Calibrate', exact: false },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-white/10 flex justify-around p-2 md:hidden z-50",
      className
    )}>
      {links.map(({ to, icon: Icon, label, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          className={({ isActive }) => cn(
            "flex flex-col items-center p-3 rounded-lg transition-all min-w-0 flex-1",
            isActive
              ? "text-accent-primary bg-accent-primary/10"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
          )}
        >
          <Icon className="w-6 h-6" />
          <span className="text-xs mt-1 truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}