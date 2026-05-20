import { useFavorites } from '../hooks/useFavorites';
import { Star, BookOpen, Compass, Activity, ChevronRight, Trash2, Filter, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useState } from 'react';

export default function FavoritesPage() {
  const { favorites, loading, toggleFavorite } = useFavorites();
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Personality' | 'Content' | 'Assessment'>('All');

  const categories = ['All', 'Personality', 'Content', 'Assessment'] as const;

  const filteredFavorites = selectedCategory === 'All'
    ? favorites
    : favorites.filter(f => f.category === selectedCategory);

  const getIcon = (type: string) => {
    switch (type) {
      case 'type': return <BookOpen className="w-5 h-5" strokeWidth={1.5} />;
      case 'guide': return <Compass className="w-5 h-5" strokeWidth={1.5} />;
      case 'calibration': return <Activity className="w-5 h-5" strokeWidth={1.5} />;
      default: return <Star className="w-5 h-5" strokeWidth={1.5} />;
    }
  };

  const getLink = (fav: any) => {
    switch (fav.contentType) {
      case 'type': return `/encyclopedia?type=${fav.contentId}`;
      case 'guide': return `/guide?section=${fav.contentId}`;
      case 'calibration':
        // If it's a personality type ID (3 letters), it's from assessment
        if (fav.contentId.length === 3 && /^[A-Z]{3}$/.test(fav.contentId)) {
          return `/assessment-result?type=${fav.contentId}`;
        }
        // Otherwise it's likely a Firestore ID from Oracle analysis
        return `/calibration?id=${fav.contentId}`;
      default: return '#';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 aria-hidden="true" className="w-12 h-12 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-12 space-y-3">
        <span className="eyebrow">Saved Items</span>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-50 flex items-center gap-3">
          <Star aria-hidden="true" className="w-9 h-9 text-accent-primary" strokeWidth={1.5} fill="currentColor" />
          Your Favorites
        </h1>
        <p className="text-slate-400 text-lg">
          Quick access to your most important EPIMETHEUS insights.
        </p>
      </header>

      {favorites.length > 0 && (
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 text-slate-500 mr-2 shrink-0">
            <Filter aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-sm font-medium tracking-wide">Filter</span>
          </div>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap border',
                  isActive
                    ? 'bg-accent-primary/15 text-accent-primary border-accent-primary/30'
                    : 'bg-white/5 text-slate-400 border-slate-700/30 hover:bg-white/8 hover:text-slate-200'
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-20 glass-card space-y-4">
          <Star aria-hidden="true" className="w-16 h-16 text-slate-700 mx-auto" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-slate-100">No favorites yet</h2>
          <p className="text-slate-500 mb-6">
            Start exploring the Encyclopedia or Guide to add items here.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/encyclopedia"
              className="px-6 py-3 bg-white/5 border border-slate-700/30 hover:bg-white/8 hover:border-accent-primary/20 text-slate-100 rounded-xl transition-all"
            >
              Browse Encyclopedia
            </Link>
            <Link
              to="/guide"
              className="px-6 py-3 accent-gradient text-mystic-950 font-semibold tracking-wide rounded-xl shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Read the Guide
            </Link>
          </div>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="text-center py-20 glass-card space-y-4">
          <Filter aria-hidden="true" className="w-16 h-16 text-slate-700 mx-auto" strokeWidth={1.5} />
          <h2 className="text-xl font-semibold text-slate-100">No {selectedCategory} favorites</h2>
          <p className="text-slate-500 mb-6">
            Try selecting a different category or view all favorites.
          </p>
          <button
            onClick={() => setSelectedCategory('All')}
            className="px-6 py-3 bg-white/5 border border-slate-700/30 hover:bg-white/8 hover:border-accent-primary/20 text-slate-100 rounded-xl transition-all"
          >
            Show All Favorites
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFavorites.map((fav) => {
            // Status-color tinted icon backgrounds — harmonize with gold via muted hues (Req 4.6)
            const tintMap: Record<string, string> = {
              type: 'bg-status-info/15 text-status-info border-status-info/20',
              guide: 'bg-status-success/15 text-status-success border-status-success/20',
              calibration: 'bg-accent-primary/15 text-accent-primary border-accent-primary/20',
            };
            const tint = tintMap[fav.contentType] || 'bg-white/5 text-slate-400 border-slate-700/30';

            return (
              <div
                key={fav.id}
                className="glass-card p-4 hover:border-accent-primary/20 transition-colors group"
              >
                <div className="flex items-center justify-between gap-4">
                  <Link to={getLink(fav)} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn('p-3 rounded-xl border shrink-0', tint)}>
                      {getIcon(fav.contentType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="eyebrow">{fav.contentType}</span>
                        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-slate-700" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-primary/70">
                          {fav.category}
                        </span>
                      </div>
                      <h3 className="text-lg font-medium text-slate-100 group-hover:text-accent-primary transition-colors truncate">
                        {fav.title}
                      </h3>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        toggleFavorite(fav.contentId, fav.contentType, fav.title).catch((err) =>
                          console.error('Unhandled error in toggleFavorite:', err)
                        )
                      }
                      className="p-2 text-slate-500 hover:text-status-error transition-colors rounded-lg hover:bg-white/5"
                      title="Remove from favorites"
                      aria-label="Remove from favorites"
                    >
                      <Trash2 aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
                    </button>
                    <Link
                      to={getLink(fav)}
                      aria-label={`Open ${fav.title}`}
                      className="p-2 text-slate-500 hover:text-slate-100 transition-colors rounded-lg hover:bg-white/5"
                    >
                      <ChevronRight aria-hidden="true" className="w-5 h-5" strokeWidth={1.5} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
