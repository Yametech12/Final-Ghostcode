import React, { useEffect, Suspense, lazy } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Compass, Target, Menu, X, Shield, Map, GitCompare, BookA, Zap, Sun, Moon, User, Users, Search, Crosshair, MessageSquare, ChevronDown, Star, Brain, Activity, PieChart, LogIn, LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/EnhancedAuthContext';
import { useTheme } from '../context/ThemeContext';
import { useIsMobile, useSwipeGesture, usePullToRefresh, useMobilePerformance } from '../hooks/useMobile';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { toast } from 'sonner';

import Logo from './Logo';

// Lazy load non-critical components to reduce initial bundle size and main thread work
const FeedbackModal = lazy(() => import('./FeedbackModal'));
const OnboardingModal = lazy(() => import('./OnboardingModal'));
const OnboardingTour = lazy(() => import('./OnboardingTour'));
const CommandPalette = lazy(() => import('./CommandPalette'));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
      { name: 'Profiles', path: '/profiles', icon: User, desc: 'Manage profiles' },
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
  const auth = useAuth();
  const { user, logout } = auth || {};

  // Mobile optimizations
  const isMobile = useIsMobile();
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture(
    () => setIsMenuOpen(false), // Swipe left to close menu
    () => setIsMenuOpen(true)   // Swipe right to open menu
  );

  // Pull to refresh functionality
  const { pullDistance } = usePullToRefresh(async () => {
    // Refresh current page data
    window.location.reload();
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/', { replace: true });
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
      // Ignore empty rejections or specific Firebase Auth cancellations
      if (!event.reason) return;
      
      const reason = event.reason;
      const code = reason?.code || (typeof reason === 'string' ? reason : null);

      if (code === 'auth/popup-closed-by-user' || 
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/user-cancelled') {
        return;
      }

      console.error('Unhandled promise rejection:', reason || 'No reason provided', event);
      
      // Only toast if it's a meaningful error
      let message = reason?.message || (typeof reason === 'string' ? reason : null);
      
      // Try to parse JSON error info from handleFirestoreError
      try {
        if (typeof message === 'string' && message.startsWith('{') && message.endsWith('}')) {
          const errInfo = JSON.parse(message);
          if (errInfo.error && errInfo.operationType) {
            message = `System Error (${errInfo.operationType} on ${errInfo.path || 'unknown path'}): ${errInfo.error}`;
          }
        }
      } catch {
        // Not JSON, use original message
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

  // Dropdown items filtering
  const getFilteredGroupItems = (group: typeof navGroups[0]) => {
    return group.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
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
      onTouchStart={isMobile ? onTouchStart : undefined}
      onTouchMove={isMobile ? onTouchMove : undefined}
      onTouchEnd={isMobile ? onTouchEnd : undefined}
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
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b",
        scrolled 
          ? "bg-mystic-950 border-white/10 py-1 shadow-2xl shadow-black/50" 
          : "bg-mystic-950 border-transparent py-3"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group shrink-0">
                <Logo size="md" className="group-hover:scale-110 transition-transform glow-accent" />
                <span className="text-xl font-bold tracking-tight text-gradient leading-none">EPIMETHEUS</span>
              </Link>

              {/* Desktop Nav Items */}
              <div className="hidden xl:flex items-center space-x-1">
                {/* Core Items */}
                {filteredCoreItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    data-tour={item.name.toLowerCase()}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 relative group leading-none",
                      location.pathname === item.path
                        ? "text-accent-primary bg-accent-primary/5"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 transition-transform group-hover:scale-110",
                      location.pathname === item.path ? "text-accent-primary" : "text-slate-500 group-hover:text-accent-primary"
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
                  
                  return (
                    <div 
                      key={group.label} 
                      className="relative"
                      onMouseEnter={() => handleMouseEnter(group.label)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <button
                        data-tour={group.label.toLowerCase()}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 group leading-none",
                          group.items.some(i => i.path === location.pathname)
                            ? "text-accent-primary bg-accent-primary/5"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <span>{group.label}</span>
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-300",
                          activeDropdown === group.label ? "rotate-180" : ""
                        )} />
                      </button>

                      {activeDropdown === group.label && (
                        <div className="absolute top-full left-0 mt-1 w-56 bg-mystic-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 z-[60]">
                          {group.items.map((item) => (
                            <Link
                              key={item.name}
                              to={item.path}
                              data-tour={item.name.toLowerCase()}
                              onClick={() => setActiveDropdown(null)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                location.pathname === item.path
                                  ? "text-accent-primary bg-accent-primary/10"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              )}
                            >
                              <item.icon className={cn(
                                "w-4 h-4",
                                location.pathname === item.path ? "text-accent-primary" : "text-slate-500 group-hover:text-accent-primary"
                              )} />
                              <div className="flex-1">
                                <div>{item.name}</div>
                                {item.desc && (
                                  <div className="text-xs text-slate-600">{item.desc}</div>
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
              <div className="hidden xl:flex items-center gap-4">
                <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500 group-focus-within:text-accent-primary transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search system..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm w-40 focus:outline-none focus:border-accent-primary/50 focus:w-56 transition-all leading-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              <div className="h-6 w-px bg-white/10 mx-2" />

              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {user ? (
                <div
                  className="relative"
                  onMouseEnter={() => handleMouseEnter('profile')}
                  onMouseLeave={handleMouseLeave}
                >
                  <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <img
                      src={user.photoURL || undefined}
                      alt={user.displayName || 'User'}
                      className="w-8 h-8 rounded-full border border-white/10 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  </button>

                  {activeDropdown === 'profile' && (
                    <div className="absolute top-full right-0 mt-1 w-56 bg-mystic-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 z-[60]">
                      <div className="flex flex-col mb-3 pb-3 border-b border-white/10">
                        <span className="text-sm font-bold text-white break-words">{user.displayName}</span>
                        <span className="text-xs text-slate-400 break-words">{user.email}</span>
                      </div>
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          handleLogout();
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-all"
                      >
                        <LogOut className="w-4 h-4" />
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
            <div className="xl:hidden flex items-center gap-2">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={cn(
                    "xl:hidden p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors",
                    isMobile ? "min-h-[44px] min-w-[44px]" : "" // Larger touch targets on mobile
                  )}
                >
                  {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="fixed inset-0 h-[100dvh] w-full z-[60] xl:hidden bg-mystic-950 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-white/5 shrink-0">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                <Logo size="md" className="glow-accent" />
                <span className="text-xl font-bold tracking-tight text-gradient leading-none">EPIMETHEUS</span>
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  {isDark ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                </button>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 overscroll-contain" data-lenis-prevent>
              {/* Mobile Search */}
              <div className="relative group px-2">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search system..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:outline-none focus:border-accent-primary/50 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-5 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 text-slate-500"
                  >
                    <X className="w-4 h-4" />
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
                      <h3 className="px-4 text-xs font-bold text-slate-600 uppercase tracking-[0.2em]">{group.label}</h3>
                      <div className="grid grid-cols-1 gap-2">
                        {filteredItems.map((item) => (
                          <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-4 px-4 py-4 rounded-2xl text-lg font-medium transition-all border group",
                              location.pathname === item.path
                                ? "text-accent-primary bg-gradient-to-r from-accent-primary/10 to-transparent border-accent-primary/20"
                                : "text-slate-300 hover:text-white hover:bg-white/5 border-transparent hover:border-white/5"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                              location.pathname === item.path 
                                ? "bg-gradient-to-br from-accent-primary to-accent-secondary text-white shadow-lg shadow-accent-primary/30" 
                                : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white"
                            )}>
                              <item.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="font-bold">{item.name}</div>
                              <div className={cn(
                                "text-xs mt-0.5",
                                location.pathname === item.path ? "text-accent-primary/70" : "text-slate-600"
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
                      <Search className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-slate-500 italic">No matches found for "{searchQuery}"</p>
                  </div>
                )}
              </div>

              {user ? (
                <div className="flex items-center gap-3 mb-6">
                  <img
                    src={user.photoURL || undefined}
                    alt={user.displayName || 'User'}
                    className="w-12 h-12 rounded-full border-2 border-white/20 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold text-lg truncate">{user.displayName}</div>
                    <div className="text-slate-400 text-sm truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    navigate('/login');
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-5 rounded-2xl accent-gradient text-white font-bold shadow-lg shadow-accent-primary/20"
                >
                  <LogIn className="w-6 h-6" />
                  Sign In
                </button>
              )}
            </div>

            <div className="p-6 border-t border-white/5 bg-white/5 shrink-0">
              <p className="text-center text-xs text-slate-600 font-bold uppercase tracking-widest">
                © 2026 Epimetheus
              </p>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className={cn("pt-24 flex flex-col", location.pathname === '/advisor' ? "h-[100dvh] overflow-hidden pb-20" : "min-h-screen pb-20 lg:pb-0")}>
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
              <p className="text-slate-500 text-sm max-w-md">
                The ultimate system for understanding female psychology and personality dynamics. 
                Based on the research of Vin DiCarlo & Brian Burke.
              </p>
            </div>
            <div className="text-left md:text-right">
              <button
                onClick={() => setIsFeedbackOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30 text-slate-300 text-sm font-bold hover:from-accent-primary/30 hover:to-accent-secondary/30 hover:border-accent-primary/50 hover:text-white transition-all hover:scale-105"
              >
                <MessageSquare className="w-4 h-4" />
                Send Feedback
              </button>
            </div>
          </div>
          <div className="pt-8 text-center">
            <p className="text-slate-500 text-sm font-medium">
              © 2026 EPIMETHEUS
            </p>
          </div>
        </div>
      </footer>
      )}

      <Suspense fallback={null}>
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        <OnboardingModal />
        <OnboardingTour />
      </Suspense>
    </div>
  );
}
