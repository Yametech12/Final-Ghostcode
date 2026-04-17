import React from 'react';
import { Star } from 'lucide-react';
import { useFavorites } from '../hooks/useFavorites';
import { cn } from '../lib/utils';

interface FavoriteButtonProps {
  contentId: string;
  contentType: 'type' | 'guide' | 'calibration';
  title: string;
  className?: string;
}

export default function FavoriteButton({ contentId, contentType, title, className }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(contentId, contentType);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(contentId, contentType, title).catch(err => {
      console.error("Failed to toggle favorite:", err);
    });
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "p-2 rounded-full transition-all hover:scale-110 active:scale-90",
        active 
          ? "bg-accent-primary/20 text-accent-primary" 
          : "bg-slate-800/50 text-slate-400 hover:text-slate-200",
        className
      )}
      title={active ? "Remove from favorites" : "Add to favorites"}
    >
      <Star className={cn("w-5 h-5", active && "fill-current")} />
    </button>
  );
}
