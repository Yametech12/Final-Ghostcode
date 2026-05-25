import React, { useEffect, Suspense, lazy, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, BookOpen, Compass, Target, Menu, X, Shield, Map, GitCompare, BookA, Zap, Sun, Moon, User, Users, Search, Crosshair, MessageSquare, ChevronDown, Star, Brain, Activity, PieChart, LogIn, LogOut } from 'lucide-react';
import { useEnhancedAuth } from '../../contexts/EnhancedAuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile, usePullToRefresh, useMobilePerformance } from '../../hooks/useMobile';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { isAppError } from '../../lib/errors';
import { queryClient } from '../../lib/queryClient';
import { BottomNav } from './BottomNav';

import Logo from '../Logo';
import LanguageToggle from '../LanguageToggle';

// Lazy load non-critical components to reduce initial bundle size and main thread work
const FeedbackModal = lazy(() => import('../FeedbackModal'));
const OnboardingModal = lazy(() => import('../OnboardingModal'));
const OnboardingTour = lazy(() => import('../OnboardingTour'));
const CommandPalette = lazy(() => import('./CommandPalette'));

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  desc?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Core',
    items: [
      { name: 'Home', path: '/', icon: Home, desc: 'Dashboard overview' },
      { name: 'Profile', path: '/profile', icon: User, desc: 'Manage profile' },
      { name: 'Dossiers', path: '/dossiers', icon: Users, desc: 'Saved contacts' },
      { name: 'Favorites', path: '/favorites', icon: Star, desc: 'Top picks' },
      { name: 'Insights', path: '/insights', icon: PieChart, desc: 'Analytics' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { name: 'Profiler', path: '/profiler', icon: Crosshair, desc: 'Analyze targets' },
      { name: 'Decryptor', path: '/decryptor', icon: MessageSquare, desc: 'Decode messages' },
      { name: 'Simulation', path: '/simulation', icon: Activity, desc: 'Practice scenarios' },
      { name: 'Calibration', path: '/calibration', icon: Target, desc: 'Test accuracy' },
      { name: 'Advisor', path: '/advisor', icon: Shield, desc: 'AI strategist' },
      { name: 'Compare', path: '/compare', icon: GitCompare, desc: 'Side by side' },
      { name: 'Quiz', path: '/quiz', icon: Brain, desc: 'Knowledge check' },
    ]
  },
  {
    label: 'Reference',
    items: [
      { name: 'Guide', path: '/guide', icon: Compass, desc: 'Full system guide' },
      { name: 'Field Guide', path: '/field-guide', icon: Map, desc: 'Practical tips' },
      { name: 'Encyclopedia', path: '/encyclopedia', icon: BookOpen, desc: 'Type reference' },
      { name: 'Glossary', path: '/glossary', icon: BookA, desc: 'Terms & defs' },
      { name: 'Quick Ref', path: '/quick-reference', icon: Zap, desc: 'Cheat sheet' },
    ]
  }
];

export default function Layout({ children }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [scrolled, setScrolled] = React.useState(false);
  const { isDark, toggleTheme } = useTheme();
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false);
  const [activeDropdown, setActiveDropdown] = React.useState<string | null>(null);
  const dropdownTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useEnhancedAuth();
  const { user, signOut, userData } = auth || {};

  // Mobile optimizations
  const isMobile = useIsMobile();
  // Swipe gestures intentionally NOT wired to the whole layout — they conflict with vertical scroll
  // on long pages. The mobile menu has explicit close button and Escape handler instead.

  // Pull to refresh — invalidate React Query cache instead of nuking the SPA.
  // Using window.location.reload() loses auth/session state and tears down React.
  const { pullDistance } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries();
    toast.success('Refreshed');
  });

  // Mobile performance optimizations
  useMobilePerformance();

  // Session timeout management (30 min, warning at 2 min)
  useSessionTimeout(
    30 * 60 * 1000,
    2 * 60 * 1000,
    () => {
      toast.warning('Session expiring soon', {
        description: 'You will be logged out due to inactivity. Click to stay signed in.',
        action: {
          label: 'Stay Signed In',
          onClick: () => toast.dismiss()
        },
        duration: 15000,
      });
    },
    () => {
      toast.info('Session expired', {
        description: 'You have been logged out due to inactivity.',
      });
    }
  );

  const handleMouseEnter = (label: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(label);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 500);
  };

  // Toggle dropdown — used for click events (touch + keyboard friendly)
  const toggleDropdown = (label: string) => {
    setActiveDropdown(prev => (prev === label ? null : label));
  };

  // Track the nav element so we can close dropdowns on outside-click
  const navRef = useRef<HTMLElement>(null);

  // Close dropdowns when clicking outside the nav
  useEffect(() => {
    if (!activeDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  // Close dropdowns and mobile menu on Escape
  useEffect(() => {
    if (!activeDropdown && !isMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activeDropdown, isMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
      setIsMenuOpen(false);
    } catch {
      toast.error('Logout failed');
    }
  };



  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  // Global error handling for unhandled rejections
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!event.reason) return;

      const reason = event.reason;
      console.error('Unhandled promise rejection:', reason, event);

      // Prefer structured AppError fields over JSON-parsing the message.
      let message: string | null = null;
      if (isAppError(reason)) {
        message = `System Error (${reason.operationType ?? 'unknown'} on ${reason.path ?? 'unknown path'}): ${reason.message}`;
      } else {
        message = reason?.message || (typeof reason === 'string' ? reason : null);
      }

      if (message) {
        toast.error(message);
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  // Scroll listener for nav background effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Theme toggle effect


  // Scroll to top on navigation
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navGroups = NAV_GROUPS;

  // Dropdown items filtering — match either an item name OR the group label,
  // so searching "tools" reveals the whole Tools group instead of hiding it.
  const matchesGroupOrItem = (groupLabel: string, itemName: string) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return groupLabel.toLowerCase().includes(q) || itemName.toLowerCase().includes(q);
  };

  const getFilteredGroupItems = (group: typeof navGroups[0]) => {
    return group.items.filter((item) => matchesGroupOrItem(group.label, item.name));
  };

  const hasSearchResults = searchQuery.length > 0;
  const filteredCoreItems = getFilteredGroupItems(navGroups[0]);
  const filteredToolsItems = getFilteredGroupItems(navGroups[1]);
  const filteredRefItems = getFilteredGroupItems(navGroups[2]);

  return (
    <div
      className={cn(
        "min-h-screen bg-mystic-950 text-slate-300 selection:bg-accent-primary/30 selection:text-accent-primary relative overflow-x-hidden",
        location.pathname === '/advisor' ? "h-[100dvh] overflow-hidden" : ""
      )}
    >
      {/* Pull to Refresh Indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-mystic-950 border-b border-white/10">
          <div className="flex items-center justify-center py-4">
            <div className={cn(
              "w-6 h-6 transition-transform duration-200",
              pullDistance > 60 ? "rotate-180 text-accent-primary" : "text-slate-400"
            )}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
            <span className="ml-2 text-sm text-slate-400">
              {pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary/30">
            <div
              className="h-full bg-accent-primary transition-all duration-200"
              style={{ width: `${Math.min((pullDistance / 60) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <div className="atmosphere" />
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-secondary/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }} />
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        aria-label="Primary"
        className={cn(
          "fixed top-0 left-0 right-0 z-50 border-b safe-area-x",
          "transition-[background-color,backdrop-filter,border-color,box-shadow,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          scrolled
            ? "bg-mystic-950/80 backdrop-blur-xl border-slate-700/20 py-1 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.4)]"
            : "bg-mystic-950/0 backdrop-blur-md border-transparent py-3"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <Logo size="md" className="group-hover:scale-110 transition-transform glow-accent" />
                <span className="text-xl font-bold tracking-tight text-gradient leading-none">EPIMETHEUS</span>
              </Link>

              {/* Desktop Nav Items */}
              <div className="hidden lg:flex items-center space-x-1">
                {/* Core Items */}
                {filteredCoreItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    data-tour={item.name.toLowerCase()}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 relative group leading-none",
                      location.pathname === item.path
                        ? "text-accent-primary"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      location.pathname === item.path
                        ? "text-accent-primary drop-shadow-[0_0_8px_rgba(232,199,126,0.4)]"
                        : "text-slate-500 group-hover:text-accent-primary"
                    )} />
                    <span>{item.name}</span>
                    {location.pathname === item.path && (
                      <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent-primary rounded-full" />
                    )}
                  </Link>
                ))}

                {/* Dropdowns */}
                {[
                  { label: 'Tools', items: filteredToolsItems },
                  { label: 'Reference', items: filteredRefItems }
                ].map((group) => {
                  if (hasSearchResults && group.items.length === 0) return null;
                  const isOpen = activeDropdown === group.label;
                  const isGroupActive = group.items.some(i => i.path === location.pathname);

                  return (
                    <div
                      key={group.label}
                      className="relative"
                      onMouseEnter={() => handleMouseEnter(group.label)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        type="button"
                        data-tour={group.label.toLowerCase()}
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        onClick={() => toggleDropdown(group.label)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 group leading-none relative",
                          isGroupActive
                            ? "text-accent-primary"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <span>{group.label}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            isOpen ? "rotate-180" : ""
                          )}
                        />
                        {isGroupActive && (
                          <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-accent-primary rounded-full" />
                        )}
                      </button>

                      {isOpen && (
                        <div
                          role="menu"
                          className={cn(
                            "absolute top-full left-0 mt-2 w-56 z-[60]",
                            "bg-mystic-900/85 backdrop-blur-xl border border-accent-primary/8",
                            "rounded-2xl p-3",
                            "shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]",
                            "animate-[fadeIn_200ms_cubic-bezier(0.32,0.72,0,1)]"
                          )}
                        >
                          {group.items.map((item) => (
                            <Link
                              key={item.name}
                              to={item.path}
                              role="menuitem"
                              data-tour={item.name.toLowerCase()}
                              onClick={() => setActiveDropdown(null)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                location.pathname === item.path
                                  ? "text-accent-primary bg-accent-primary/10"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                            >
                              <item.icon
                                aria-hidden="true"
                                className={cn(
                                  "w-4 h-4",
                                  location.pathname === item.path
                                    ? "text-accent-primary drop-shadow-[0_0_6px_rgba(232,199,126,0.4)]"
                                    : "text-slate-500 group-hover:text-accent-primary"
                                )}
                              />
                              <div className="flex-1">
                                <div>{item.name}</div>
                                {item.desc && (
                                  <div className="text-xs text-slate-500">{item.desc}</div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

              {/* Desktop Actions */}
              <div className="hidden lg:flex items-center gap-4">
                <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search
                    aria-hidden="true"
                    className={cn(
                      "w-4 h-4 transition-colors",
                      "text-slate-500 group-focus-within:text-accent-primary",
                      "group-focus-within:animate-[pulse-once_600ms_ease-out]"
                    )}
                  />
                </div>
                <label htmlFor="nav-search" className="sr-only">Search system</label>
                <input
                  id="nav-search"
                  type="text"
                  placeholder="Search system..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-16 text-sm w-56 leading-none",
                    "focus:outline-none focus:border-accent-primary/60",
                    "focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)]",
                    "transition-[border-color,box-shadow] duration-200"
                  )}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                  >
                    <X aria-hidden="true" className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd
                    aria-hidden="true"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white/5 border border-accent-primary/15 rounded"
                  >
                    ⌘K
                  </kbd>
                )}
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-2" />

              <LanguageToggle />

              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="tap-target rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
              </button>

              {user ? (
                <div
                  className="relative"
                  onMouseEnter={() => handleMouseEnter('profile')}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={activeDropdown === 'profile'}
                    aria-label="Open user menu"
                    onClick={() => toggleDropdown('profile')}
                    className="tap-target rounded-full hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={user.photoURL || undefined}
                      alt=""
                      className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  </button>

                  {activeDropdown === 'profile' && (
                    <div role="menu" className="absolute top-full right-0 mt-2 w-56 bg-mystic-900/85 backdrop-blur-xl border border-accent-primary/8 rounded-2xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] p-3 z-[60] animate-[fadeIn_200ms_cubic-bezier(0.32,0.72,0,1)]">
                      <div className="flex flex-col mb-3 pb-3 border-b border-slate-700/30">
                        <span className="text-sm font-semibold text-slate-100 break-words">{user.displayName}</span>
                        <span className="text-xs text-slate-400 break-words">{user.email}</span>
                      </div>
                      {userData?.role === 'admin' && (
                        <Link
                          to="/admin"
                          role="menuitem"
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-accent-primary hover:bg-accent-primary/10 transition-colors mb-1"
                        >
                          <Shield className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                          Admin Dashboard
                        </Link>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setActiveDropdown(null);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-status-error hover:bg-status-error/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    navigate('/login');
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl accent-gradient text-white text-sm font-bold shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all leading-none"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              )}

            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center gap-2">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={isMenuOpen}
                  className={cn(
                    "lg:hidden tap-target rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
                  )}
                >
                  {isMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
                </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 h-screen h-[100dvh] w-full z-[60] lg:hidden bg-mystic-950/95 backdrop-blur-xl flex flex-col overflow-hidden safe-area-top safe-area-bottom safe-area-x"
          >
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-slate-700/30 shrink-0">
              <div className="flex items-center gap-2">
                <Logo size="md" className="glow-accent" />
                <span className="text-xl font-bold tracking-tight text-gradient leading-none">EPIMETHEUS</span>
              </div>
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <button
                  onClick={toggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="tap-target rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {isDark ? <Sun className="w-6 h-6" aria-hidden="true" /> : <Moon className="w-6 h-6" aria-hidden="true" />}
                </button>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                  className="tap-target rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 overscroll-contain" data-lenis-prevent>
              {/* Mobile Search */}
              <div className="relative group px-2">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Search aria-hidden="true" className="w-5 h-5 text-slate-500 group-focus-within:text-accent-primary transition-colors" />
                </div>
                <label htmlFor="mobile-search" className="sr-only">Search system</label>
                <input
                  id="mobile-search"
                  type="text"
                  placeholder="Search system..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base",
                    "focus:outline-none focus:border-accent-primary/60",
                    "focus:shadow-[0_0_0_3px_rgba(232,199,126,0.12)]",
                    "transition-[border-color,box-shadow] duration-200"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 text-slate-500"
                  >
                    <X aria-hidden="true" className="w-4 h-4" />
                  </button>
                )}
              </div>




              <div className="space-y-8">
                {navGroups.map((group) => {
                  const filteredItems = group.items.filter(item => 
                    item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  
                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={group.label} className="space-y-4">
                      <h3 className="px-4 eyebrow">{group.label}</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {filteredItems.map((item) => (
                          <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={cn(
                              "relative flex items-center gap-4 px-4 py-4 rounded-2xl text-lg font-medium transition-all border group",
                              location.pathname === item.path
                                ? "text-accent-primary bg-accent-primary/5 border-accent-primary/15"
                                : "text-slate-300 hover:text-white hover:bg-white/5 border-transparent hover:border-slate-700/30"
                            )}
                          >
                            {location.pathname === item.path && (
                              <span
                                aria-hidden="true"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full bg-accent-primary"
                              />
                            )}
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                              location.pathname === item.path
                                ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/20"
                                : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white"
                            )}>
                              <item.icon className={cn(
                                "w-5 h-5",
                                location.pathname === item.path && "drop-shadow-[0_0_6px_rgba(232,199,126,0.4)]"
                              )} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold">{item.name}</div>
                              <div className={cn(
                                "text-xs mt-0.5",
                                location.pathname === item.path ? "text-accent-primary/70" : "text-slate-400"
                              )}>{item.desc}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                {searchQuery && navGroups.every(g => !g.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))) && (
                  <div className="px-6 py-12 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                      <Search aria-hidden="true" className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-400 italic">No matches found for "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.photoURL || undefined}
                      alt=""
                      className="w-12 h-12 rounded-full border-2 border-slate-700/30 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-100 font-semibold text-lg truncate">{user.displayName}</div>
                      <div className="text-slate-400 text-sm truncate">{user.email}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      aria-label="Sign out"
                      className="tap-target rounded-xl text-slate-400 hover:text-status-error hover:bg-status-error/10 transition-colors"
                    >
                      <LogOut aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                  </div>
                  {userData?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary font-semibold tracking-wide transition-colors hover:bg-accent-primary/15"
                    >
                      <Shield aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
                      Admin Dashboard
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    navigate('/login');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-5 rounded-2xl accent-gradient text-white font-bold shadow-lg shadow-accent-primary/20"
                >
                  <LogIn aria-hidden="true" className="w-6 h-6" />
                  Sign In
                </button>
              )}
            </div>

            <div className="p-6 border-t border-slate-700/30 bg-white/[0.03] shrink-0 safe-area-bottom">
              <p className="text-center eyebrow">
                © 2026 Epimetheus
              </p>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </nav>

      {/* Main Content — pt-24 reserves space for the fixed nav */}
      <main className={cn("pt-24 flex flex-col", location.pathname === '/advisor' ? "h-[100dvh] overflow-hidden pb-16" : "min-h-screen pb-24 lg:pb-0")}>
        <div className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col w-full",
          location.pathname === '/advisor' ? "max-w-[100rem] pt-4 pb-4 h-full overflow-hidden" : "max-w-7xl pt-12 pb-12"
        )}>
          {children}
        </div>
      </main>

      {/* Footer */}
      {location.pathname !== '/advisor' && (
        <footer className="bg-mystic-950 border-t border-white/5 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Logo size="md" className="glow-accent" />
                <span className="text-xl font-bold tracking-tight text-gradient">EPIMETHEUS</span>
              </div>
              <p className="text-slate-400 text-sm max-w-md">
                The ultimate system for understanding female psychology and personality dynamics.
                Based on the research of Vin DiCarlo & Brian Burke.
              </p>
            </div>
            <div className="text-left md:text-right">
              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30 text-slate-200 text-sm font-bold hover:from-accent-primary/30 hover:to-accent-secondary/30 hover:border-accent-primary/50 hover:text-white transition-all hover:scale-105"
              >
                <MessageSquare aria-hidden="true" className="w-4 h-4" />
                Send Feedback
              </button>
            </div>
          </div>
          <div className="pt-8 text-center">
            <p className="text-slate-400 text-sm font-medium">
              © 2026 EPIMETHEUS
            </p>
          </div>
        </div>
      </footer>
      )}

      {/* Mobile bottom nav — shown when authenticated */}
      {user && <BottomNav />}

      <Suspense fallback={null}>
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <OnboardingModal />
        <OnboardingTour />
      </Suspense>
    </div>
  );
}
