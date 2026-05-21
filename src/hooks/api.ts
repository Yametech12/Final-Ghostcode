import { useQuery, useMutation } from '@tanstack/react-query';
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

// Personality Types Hook
export function usePersonalityTypes() {
  return useQuery({
    queryKey: ['personality-types'],
    queryFn: async () => {
      const { personalityTypes } = await import('../data/personalityTypes');
      return personalityTypes;
    },
    staleTime: Infinity, // This data rarely changes
  });
}
