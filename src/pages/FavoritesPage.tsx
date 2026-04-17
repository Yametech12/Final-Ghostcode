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
      case 'type': return <BookOpen className="w-5 h-5" />;
      case 'guide': return <Compass className="w-5 h-5" />;
      case 'calibration': return <Activity className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
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
        <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-12">
        <h1 className="text-4xl font-display font-bold mb-4 flex items-center gap-3">
          <Star className="w-10 h-10 text-accent-primary fill-accent-primary" />
          Your Favorites
        </h1>
        <p className="text-slate-400 text-lg">
          Quick access to your most important EPIMETHEUS insights.
        </p>
      </header>

      {favorites.length > 0 && (
        <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex items-center gap-2 text-slate-500 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                selectedCategory === cat 
                  ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20" 
                  : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <Star className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-300 mb-2">No favorites yet</h2>
          <p className="text-slate-500 mb-8">
            Start exploring the Encyclopedia or Guide to add items here.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              to="/encyclopedia" 
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
            >
              Browse Encyclopedia
            </Link>
            <Link 
              to="/guide" 
              className="px-6 py-3 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl transition-colors"
            >
              Read the Guide
            </Link>
          </div>
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <Filter className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-300 mb-2">No {selectedCategory} favorites</h2>
          <p className="text-slate-500 mb-8">
            Try selecting a different category or view all favorites.
          </p>
          <button 
            onClick={() => setSelectedCategory('All')}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            Show All Favorites
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredFavorites.map((fav) => (
            <div
              key={fav.id}
              className="glass-card p-4 hover:bg-slate-800/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <Link to={getLink(fav)} className="flex items-center gap-4 flex-1">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    fav.contentType === 'type' && "bg-blue-500/10 text-blue-400",
                    fav.contentType === 'guide' && "bg-emerald-500/10 text-emerald-400",
                    fav.contentType === 'calibration' && "bg-purple-500/10 text-purple-400"
                  )}>
                    {getIcon(fav.contentType)}
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                      <span>{fav.contentType}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-accent-primary/70">{fav.category}</span>
                    </div>
                    <h3 className="text-lg font-medium text-slate-100 group-hover:text-accent-primary transition-colors">
                      {fav.title}
                    </h3>
                  </div>
                </Link>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(fav.contentId, fav.contentType, fav.title).catch(err => console.error("Unhandled error in toggleFavorite:", err))}
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                    title="Remove from favorites"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <Link to={getLink(fav)} className="p-2 text-slate-500 hover:text-slate-200">
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
