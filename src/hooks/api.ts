import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithErrorHandling } from '../lib/fetch';

// AI Chat Hook
export function useAIChat() {
  return useMutation({
    mutationFn: async ({ messages, model, options }: {
      messages: any[];
      model?: string;
      options?: any;
    }) => {
      return fetchWithErrorHandling('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          ...options,
        }),
      });
    },
  });
}

// User Profile Hook
export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      return fetchWithErrorHandling(`/api/users/${userId}`);
    },
    enabled: !!userId,
  });
}

// Personality Types Hook
export function usePersonalityTypes() {
  return useQuery({
    queryKey: ['personality-types'],
    queryFn: async () => {
      // In a real app, this might come from an API
      // For now, we'll import the static data
      const { personalityTypes } = await import('../data/personalityTypes');
      return personalityTypes;
    },
    staleTime: Infinity, // This data rarely changes
  });
}

// Chat Sessions Hook
export function useChatSessions(userId?: string) {
  return useQuery({
    queryKey: ['chat-sessions', userId],
    queryFn: async () => {
      if (!userId) return [];
      return fetchWithErrorHandling(`/api/chat/sessions?userId=${userId}`);
    },
    enabled: !!userId,
  });
}

// Save Chat Session Mutation
export function useSaveChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: any) => {
      return fetchWithErrorHandling('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });
    },
    onSuccess: () => {
      // Invalidate and refetch chat sessions
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}