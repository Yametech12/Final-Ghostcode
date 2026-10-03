import { Link } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';

/**
 * 404 — Page not found.
 *
 * Shown for any unmatched route instead of silently redirecting home,
 * so users understand what happened and can navigate back confidently.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-mystic-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
            <Compass className="w-10 h-10 text-slate-400" aria-hidden />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-mono text-slate-500 tracking-widest">404</p>
            <h1 className="text-3xl font-bold text-slate-50">This path leads nowhere</h1>
            <p className="text-slate-400">
              The page you're looking for doesn't exist or may have moved.
              Let's get you back on track.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-100 font-bold hover:bg-white/10 transition-all"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
              Go back
            </button>
            <Link
              to="/"
              className="flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient text-mystic-950 font-bold hover:scale-[1.02] transition-all"
            >
              <Home className="w-4 h-4" aria-hidden />
              Home
            </Link>
          </div>
        </div>
      </div>
  );
}
