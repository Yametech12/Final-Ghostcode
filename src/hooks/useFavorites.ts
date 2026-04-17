import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Favorite } from '../types';
import { toast } from 'sonner';

const getCategory = (type: string): 'Personality' | 'Content' | 'Assessment' => {
  switch (type) {
    case 'type': return 'Personality';
    case 'guide': return 'Content';
    case 'calibration': return 'Assessment';
    default: return 'Content';
  }
};

export function useFavorites() {
  const auth = useAuth();
  if (!auth) {
    return { favorites: [], loading: true, toggleFavorite: async () => {}, isFavorite: () => false };
  }
  const { user } = auth;
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    // Set up real-time subscription
    const channel = supabase
      .channel('favorites_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          // Re-fetch all favorites when there's a change
          const { data, error } = await supabase
            .from('favorites')
            .select('*')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false });

          if (error) {
            console.error('Error fetching favorites:', error);
            setLoading(false);
            return;
          }

          const favs: Favorite[] = data.map(item => ({
            id: item.id.toString(),
            userId: item.user_id,
            contentId: item.content_id,
            contentType: item.content_type,
            category: item.category || getCategory(item.content_type),
            title: item.title,
            timestamp: new Date(item.timestamp)
          }));
          setFavorites(favs);
          setLoading(false);
        }
      )
      .subscribe();

    // Initial fetch
    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching favorites:', error);
        setLoading(false);
        return;
      }

      const favs: Favorite[] = data.map(item => ({
        id: item.id.toString(),
        userId: item.user_id,
        contentId: item.content_id,
        contentType: item.content_type,
        category: item.category || getCategory(item.content_type),
        title: item.title,
        timestamp: new Date(item.timestamp)
      }));
      setFavorites(favs);
      setLoading(false);
    };

    fetchFavorites();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const toggleFavorite = async (contentId: string, contentType: 'type' | 'guide' | 'calibration', title: string) => {
    if (!user) {
      toast.error("You must be logged in to favorite items");
      return;
    }

    const existing = favorites.find(f => f.contentId === contentId && f.contentType === contentType);

    try {
      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('content_type', contentType);

        if (error) throw error;
        toast.success("Removed from favorites");
      } else {
        const newFavorite = {
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          category: getCategory(contentType),
          title,
          timestamp: new Date().toISOString()
        };

        const { error } = await supabase
          .from('favorites')
          .insert(newFavorite);

        if (error) throw error;
        toast.success("Added to favorites");
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorites");
    }
  };

  const isFavorite = (contentId: string, contentType: string) => {
    return favorites.some(f => f.contentId === contentId && f.contentType === contentType);
  };

  return { favorites, loading, toggleFavorite, isFavorite };
}
