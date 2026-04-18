import "dotenv/config";
// Polyfill ReadableStream for Node.js < 18
import { ReadableStream } from 'node:stream/web';

let apiKey: string | null = null;

// Centralized model configuration - single source of truth
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
export const VISION_MODEL = "openai/gpt-4o-mini";
export const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet-latest",
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemma-3-5it-mini:free",
  "microsoft/wizardlm-2-8x22b"
];

export async function getApiKey(): Promise<string> {
  if (!apiKey) {
    apiKey = process.env.OPENROUTER_API_KEY || "";
  }

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Please set the OPENROUTER_API_KEY environment variable."
    );
  }

  return apiKey;
}

// AI completion function for OpenRouter with model fallback
export async function createCompletion({
  model,
  messages,
  temperature = 0.7,
  response_format = null,
  max_tokens = 2000,
  stream = false
}: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  response_format?: any;
  max_tokens?: number;
  stream?: boolean;
}) {
  const apiKey = await getApiKey();
  const modelsToTry = [model || DEFAULT_MODEL, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: Error | null = null;

  for (const modelToTry of modelsToTry) {
    try {
      console.log(`Trying model: ${modelToTry}`);
      
      const payload: any = {
        model: modelToTry,
        messages,
        temperature,
        max_tokens,
        stream
      };

      if (response_format) {
        payload.response_format = response_format;
      }

      // Try up to 3 times per model for rate limits
      for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
            'X-Title': 'Epimetheus AI'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`Success with model: ${modelToTry}`);
          if (stream) {
            return response.body; // Return readable stream
          }
          const data = await response.json();
          return data;
        }

        const errorText = await response.text();
        console.warn(`Model ${modelToTry} failed (attempt ${attempt}/3): ${response.status}`, errorText.substring(0, 200));
        
        // Handle rate limits with exponential backoff
        if (response.status === 429 && attempt < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          const wait = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt - 1));
          console.warn(`Rate limited, waiting ${wait}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
        
        // Don't retry on auth errors, payment required, etc.
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        }
        
        lastError = new Error(`OpenRouter API error: ${response.status} ${errorText}`);
        
        // For 400/404 (model not found), try next model
        if (response.status === 400 || response.status === 404) {
          break; // Break retry loop and try next model
        }
        
        // For other errors, break and try next model
        break;
      }
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`Model ${modelToTry} failed with error:`, error);
      continue;
    }
  }

  // If all models failed
  throw lastError || new Error("All AI models failed");
}

// Streaming completion helper
export async function* createStreamingCompletion({
  model,
  messages,
  temperature = 0.7,
  response_format = null,
  max_tokens = 2000
}: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  response_format?: any;
  max_tokens?: number;
}) {
  let stream;
  try {
    stream = await createCompletion({
      model,
      messages,
      temperature,
      response_format,
      max_tokens,
      stream: true
    });
  } catch (error) {
    console.error('Failed to create streaming completion:', error);
    throw error; // Properly propagate initialization errors
  }

  const reader = (stream as ReadableStream).getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      let result;
      try {
        result = await reader.read();
      } catch (readError) {
        console.error('Stream read error:', readError);
        throw readError;
      }

      const { done, value } = result;
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error.message || parsed.error);
            }
            yield parsed;
          } catch (e) {
            console.error('Failed to parse streaming chunk:', e, 'Chunk:', line);
            // Don't swallow parser errors - yield as error or skip
            // For now, skip invalid chunks to keep stream alive
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch (e) {
      console.warn('Error releasing stream lock:', e);
    }
  }
}

