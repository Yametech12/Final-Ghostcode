import { Link } from 'react-router-dom';
import Logo from '../Logo';

/**
 * Shared marketing-site footer.
 *
 * Extracted from the duplicated LandingPage/PricingPage chrome (Oct 2026
 * design-consistency pass). The two copies had drifted on the first link
 * (Landing → /pricing "Pricing", Pricing → /welcome "Home"); the unified
 * set is: Pricing, Features (→ /#features), Terms, Privacy, Sign in.
 */
export default function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span>© {new Date().getFullYear()} Yame Coaching · EPIMETHEUS</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/pricing" className="hover:text-slate-200 transition-colors">
            Pricing
          </Link>
          <Link to="/#features" className="hover:text-slate-200 transition-colors">
            Features
          </Link>
          <Link to="/terms" className="hover:text-slate-200 transition-colors">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-slate-200 transition-colors">
            Privacy
          </Link>
          <Link to="/login" className="hover:text-slate-200 transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
