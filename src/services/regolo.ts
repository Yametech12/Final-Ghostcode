/**
 * Regolo AI API Wrapper
 * Handles all interactions with the Regolo API for AI completions
 */

interface RegoloChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RegoloCompletionRequest {
  messages: RegoloChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface RegoloCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: RegoloChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const REGOLO_API_KEY = import.meta.env.VITE_REGOLO_API_KEY;
const REGOLO_ENDPOINT = import.meta.env.VITE_REGOLO_ENDPOINT || 'https://api.regolo.ai/v1';

if (!REGOLO_API_KEY) {
  console.warn('VITE_REGOLO_API_KEY not configured. Regolo API will not work.');
}

/**
 * Create a chat completion using Regolo API
 */
export async function createRegoloCompletion(
  request: RegoloCompletionRequest
): Promise<RegoloCompletionResponse> {
  if (!REGOLO_API_KEY) {
    throw new Error('Regolo API key is not configured');
  }

  try {
    const response = await fetch(`${REGOLO_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${REGOLO_API_KEY}`,
      },
      body: JSON.stringify({
        model: request.model || 'llama-2-70b-chat',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
        top_p: request.top_p ?? 0.95,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Regolo API error: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    return await response.json();
  } catch (error) {
    console.error('Regolo API call failed:', error);
    throw error;
  }
}

/**
 * Stream a chat completion using Regolo API
 */
export async function* streamRegoloCompletion(
  request: RegoloCompletionRequest
): AsyncGenerator<string> {
  if (!REGOLO_API_KEY) {
    throw new Error('Regolo API key is not configured');
  }

  try {
    const response = await fetch(`${REGOLO_ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${REGOLO_API_KEY}`,
      },
      body: JSON.stringify({
        model: request.model || 'llama-2-70b-chat',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 1000,
        top_p: request.top_p ?? 0.95,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Regolo API error: ${response.status} ${response.statusText} - ${
          errorData.error?.message || 'Unknown error'
        }`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Ignore parse errors for non-JSON lines
          }
        }
      }

      buffer = lines[lines.length - 1];
    }
  } catch (error) {
    console.error('Regolo streaming failed:', error);
    throw error;
  }
}

/**
 * Simple text completion
 */
export async function completeText(
  prompt: string,
  options?: Partial<RegoloCompletionRequest>
): Promise<string> {
  const response = await createRegoloCompletion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1000,
    ...options,
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Chat with Regolo AI
 */
export async function chat(
  messages: RegoloChatMessage[],
  options?: Partial<RegoloCompletionRequest>
): Promise<string> {
  const response = await createRegoloCompletion({
    messages,
    temperature: 0.7,
    max_tokens: 2000,
    ...options,
  });

  return response.choices[0]?.message?.content || '';
}

export type { RegoloChatMessage, RegoloCompletionRequest, RegoloCompletionResponse };
