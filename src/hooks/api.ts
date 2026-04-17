import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// AI Chat Hook
export function useAIChat() {
  return useMutation({
    mutationFn: async ({ messages, model, options }: {
      messages: any[];
      model?: string;
      options?: any;
    }) => {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          ...options,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI request failed');
      }

      return response.json();
    },
  });
}

// User Profile Hook
export function useUserProfile(userId?: string) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      if (!userId) return null;

      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user profile');
      return response.json();
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

      const response = await fetch(`/api/chat/sessions?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch chat sessions');
      return response.json();
    },
    enabled: !!userId,
  });
}

// Save Chat Session Mutation
export function useSaveChatSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionData: any) => {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) throw new Error('Failed to save chat session');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch chat sessions
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    },
  });
}