import "dotenv/config";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || null;
const REGOLO_API_KEY = process.env.REGOLO_API_KEY || null;

// OpenRouter models
export const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
export const VISION_MODEL = "anthropic/claude-3.5-sonnet";
const FALLBACK_MODELS = [
  "anthropic/claude-3.5-sonnet",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemma-2-27b-instruct"
];

export async function getApiKey(): Promise<string | null> {
  if (OPENROUTER_API_KEY) return OPENROUTER_API_KEY;
  if (REGOLO_API_KEY) return REGOLO_API_KEY;
  console.warn("WARNING: No OpenRouter or Regolo API key configured. AI features will be disabled.");
  return null;
}

function getActiveProvider(): 'openrouter' | 'regolo' | null {
  if (OPENROUTER_API_KEY) return 'openrouter';
  if (REGOLO_API_KEY) return 'regolo';
  return null;
}

// AI completion function with model fallback across providers
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
  const key = await getApiKey();
  if (!key) {
    throw new Error(`No AI API key configured. Please set OPENROUTER_API_KEY or REGOLO_API_KEY.`);
  }

  const provider = getActiveProvider();
  const modelsToTry = [model || DEFAULT_MODEL, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: Error | null = null;

  for (const modelToTry of modelsToTry) {
    try {
      console.log(`Trying model: ${modelToTry} via ${provider}`);

      let response: Response;
      if (provider === 'openrouter') {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://epimetheusproject.vercel.app',
            'X-Title': 'Epimetheus'
          },
          body: JSON.stringify({
            model: modelToTry,
            messages,
            temperature,
            max_tokens,
            stream
          })
        });
      } else {
        // Regolo
        response = await fetch('https://api.regolo.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: modelToTry,
            messages,
            temperature,
            max_tokens,
            stream
          })
        });
      }

      if (response.ok) {
        console.log(`Success with model: ${modelToTry}`);
        if (stream) {
          return response.body;
        }
        const data = await response.json();
        return data;
      }

      const errorText = await response.text();
      console.warn(`Model ${modelToTry} failed: ${response.status}`, errorText.substring(0, 200));

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        const wait = Math.max(retryAfter * 1000, 1000 * Math.pow(2, 1));
        console.warn(`Rate limited, waiting ${wait}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }

      if (response.status === 401 || response.status === 402 || response.status === 403) {
        throw new Error(`AI API error: ${response.status} ${errorText}`);
      }

      if (response.status === 400 || response.status === 404) {
        break;
      }

      lastError = new Error(`AI API error: ${response.status} ${errorText}`);
      break;

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
    throw error;
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
      // SSE: lines are separated by \n\n
      const parts = chunk.split('\n\n');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            throw new Error(parsed.error.message || parsed.error);
          }
          yield parsed;
        } catch (e) {
          console.error('Failed to parse streaming chunk:', e, 'Chunk:', trimmed);
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