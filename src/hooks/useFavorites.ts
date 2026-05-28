import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
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
  const auth = useEnhancedAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const user = auth?.user;

  // Track whether the initial fetch has completed before we let the realtime
  // handler trigger refetches. Without this guard, an event arriving between
  // subscribe() and the first fetch's resolve can race with the initial fetch
  // and clobber it with stale data (or vice versa).
  const initialFetchDoneRef = useRef(false);
  // Coalesce bursts of postgres_changes events (e.g. a bulk insert of 5
  // favorites) into a single refetch so we don't fire N round-trips for one
  // user action.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    initialFetchDoneRef.current = false;
    const abortController = new AbortController();

    const fetchAll = async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(500)
        .abortSignal(abortController.signal);

      if (abortController.signal.aborted) return;

      if (error) {
        console.error('Error fetching favorites:', error);
        setLoading(false);
        return;
      }

      const favs: Favorite[] = (data || []).map((item) => ({
        id: item.id.toString(),
        userId: item.user_id,
        contentId: item.content_id,
        contentType: item.content_type,
        category: item.category || getCategory(item.content_type),
        title: item.title,
        timestamp: new Date(item.timestamp),
      }));
      setFavorites(favs);
      setLoading(false);
    };

    const scheduleRefetch = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        if (!abortController.signal.aborted) fetchAll();
      }, 200);
    };

    // Subscribe to changes BEFORE running the initial fetch so we don't miss
    // events that fire while the fetch is in-flight. The handler is gated on
    // initialFetchDoneRef so it doesn't race with the initial setState.
    const channel = supabase
      .channel(`favorites_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (!initialFetchDoneRef.current) return;
          scheduleRefetch();
        },
      )
      .subscribe();

    fetchAll().finally(() => {
      initialFetchDoneRef.current = true;
    });

    return () => {
      abortController.abort();
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user]);

  const toggleFavorite = async (
    contentId: string,
    contentType: 'type' | 'guide' | 'calibration',
    title: string,
  ) => {
    if (!user) {
      toast.error('You must be logged in to favorite items');
      return;
    }

    const existing = favorites.find(
      (f) => f.contentId === contentId && f.contentType === contentType,
    );

    try {
      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('content_id', contentId)
          .eq('content_type', contentType);

        if (error) throw error;
        toast.success('Removed from favorites');
      } else {
        const newFavorite = {
          user_id: user.id,
          content_id: contentId,
          content_type: contentType,
          category: getCategory(contentType),
          title,
          timestamp: new Date().toISOString(),
        };

        const { error } = await supabase.from('favorites').insert(newFavorite);

        if (error) throw error;
        toast.success('Added to favorites');
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const isFavorite = (contentId: string, contentType: string) => {
    return favorites.some(
      (f) => f.contentId === contentId && f.contentType === contentType,
    );
  };

  return { favorites, loading, toggleFavorite, isFavorite };
}
