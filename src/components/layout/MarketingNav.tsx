import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import Logo from '../Logo';
import { useTheme } from '../../contexts/ThemeContext';

export interface MarketingNavLink {
  label: string;
  /** React-router destination (renders a Link). */
  to?: string;
  /** Plain anchor href (renders an <a> — for #section anchors). */
  href?: string;
  /** Marks the link as the current page; renders as non-clickable text. */
  current?: boolean;
}

interface MarketingNavProps {
  /** Center nav links — desktop row + mobile overlay list. */
  links: MarketingNavLink[];
  /** Whether the visitor is signed in (swaps CTA cluster). */
  isSignedIn: boolean;
  /** Brand home destination. Landing uses '/welcome' for guests; pricing uses '/welcome'. */
  homePath?: string;
}

function renderNavLink(link: MarketingNavLink, onClick: () => void) {
  const className =
    'block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors';
  if (link.current) {
    return (
      <span key={link.label} className="block px-4 py-3 rounded-xl text-accent-primary bg-accent-primary/5" aria-current="page">
        {link.label}
      </span>
    );
  }
  if (link.to) {
    return (
      <Link key={link.label} to={link.to} onClick={onClick} className={className}>
        {link.label}
      </Link>
    );
  }
  return (
    <a key={link.label} href={link.href} onClick={onClick} className={className}>
      {link.label}
    </a>
  );
}

/**
 * Shared marketing-site top nav + mobile nav overlay.
 *
 * Extracted from the duplicated LandingPage/PricingPage chrome (Oct 2026
 * design-consistency pass). One nav, one footer — the two copies had
 * already drifted. Owns its mobile-menu state, so pages just drop it in.
 */
export default function MarketingNav({ links, isSignedIn, homePath }: MarketingNavProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const home = homePath ?? (isSignedIn ? '/' : '/welcome');

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-mystic-950/80 backdrop-blur-xl safe-area-x">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link
            to={home}
            className="flex items-center gap-2 sm:gap-3 group min-w-0"
            aria-label="Epimetheus home"
          >
            <Logo size="md" />
            {/* Brand wordmark hides below 360px to make room for CTAs on
                tiny phones (iPhone SE 1st gen, old Android). The logo
                glyph alone keeps the brand visible. */}
            <span className="hidden xs:inline hero-headline text-base sm:text-xl text-slate-50 tracking-tight group-hover:text-accent-primary transition-colors truncate">
              EPIMETHEUS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400" aria-label="Primary">
            {links.map((link) =>
              link.current ? (
                <span key={link.label} className="text-slate-100" aria-current="page">
                  {link.label}
                </span>
              ) : link.to ? (
                <Link key={link.label} to={link.to} className="hover:text-slate-100 transition-colors">
                  {link.label}
                </Link>
              ) : (
                <a key={link.label} href={link.href} className="hover:text-slate-100 transition-colors">
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            {/* Theme toggle — the light theme existed but was unreachable
                from any public page until this shipped. */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
            </button>
            {isSignedIn ? (
              <>
                <Link
                  to="/profile"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Profile
                </Link>
                <Link
                  to="/"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-block text-sm text-slate-300 hover:text-slate-50 px-3 py-2 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold text-mystic-950 accent-gradient px-3 sm:px-4 py-2 rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
            {/* Mobile nav trigger — only visible below md. Toggles a
                full-screen overlay panel since these pages are marketing
                surfaces (no Layout chrome). */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
              aria-controls="marketing-mobile-nav"
              className="md:hidden p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ───────────────────────── Mobile nav overlay ───────────────────────── */}
      {mobileNavOpen && (
        <div
          id="marketing-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-50 md:hidden bg-mystic-950/95 backdrop-blur-xl flex flex-col safe-area-top safe-area-bottom safe-area-x"
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
            <Link
              to={home}
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2"
            >
              <Logo size="md" />
              <span className="hero-headline text-lg text-slate-50">EPIMETHEUS</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="p-2 rounded-xl text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2 text-base" aria-label="Mobile primary">
            {links.map((link) => renderNavLink(link, () => setMobileNavOpen(false)))}
            {isSignedIn ? (
              <Link
                to="/profile"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Profile
              </Link>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="block px-4 py-3 rounded-xl text-slate-200 hover:bg-white/5 transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>
          <div className="px-4 py-4 border-t border-white/5">
            <Link
              to={isSignedIn ? '/' : '/register'}
              onClick={() => setMobileNavOpen(false)}
              className="block w-full text-center px-6 py-3 rounded-xl accent-gradient text-mystic-950 font-semibold shadow-lg shadow-accent-primary/15"
            >
              {isSignedIn ? 'Open dashboard' : 'Create free account'}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
