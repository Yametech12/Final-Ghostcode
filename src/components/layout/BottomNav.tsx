import { NavLink } from 'react-router-dom';
import { Home, User, FileText, Shield, Target } from 'lucide-react';
import { cn } from '../../lib/utils';

interface BottomNavProps {
  className?: string;
}

const links = [
  { to: '/',            icon: Home,     label: 'Home',     exact: true  },
  { to: '/profile',     icon: User,     label: 'Profile',  exact: false },
  { to: '/dossiers',    icon: FileText, label: 'Dossiers', exact: false },
  { to: '/advisor',     icon: Shield,   label: 'Advisor',  exact: false },
  { to: '/calibration', icon: Target,   label: 'Calibrate', exact: false },
];

export function BottomNav({ className = '' }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        // Hidden on lg+ — desktop has its own nav. Visible up through tablets.
        'fixed bottom-0 left-0 right-0 z-40 lg:hidden',
        'bg-mystic-950/90 backdrop-blur-lg border-t border-white/10',
        'safe-area-bottom',
        className,
      )}
    >
      <ul className="flex justify-around px-2 pt-2 pb-2">
        {links.map(({ to, icon: Icon, label, exact }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={exact}
              aria-label={label}
              className={({ isActive }) =>
                cn(
                  'tap-target flex flex-col items-center justify-center gap-1 mx-auto w-full max-w-[80px] rounded-xl transition-colors',
                  isActive
                    ? 'text-accent-primary'
                    : 'text-slate-400 hover:text-slate-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className={cn('text-[11px] leading-none', isActive && 'font-semibold')}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default BottomNav;
