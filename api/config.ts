import "dotenv/config";

let apiKey: string | null = null;
let aiProvider: 'regolo' | 'openrouter' | 'none' = 'none';

// Determine which AI provider to use
const regoloKey = process.env.REGOLO_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;

if (regoloKey) {
  apiKey = regoloKey;
  aiProvider = 'regolo';
} else if (openrouterKey) {
  apiKey = openrouterKey;
  aiProvider = 'openrouter';
}

// Regolo AI models (from https://docs.regolo.ai/)
export const DEFAULT_MODEL = "Llama-3.3-70B-Instruct";
export const VISION_MODEL = "Llama-3.3-70B-Instruct"; // Regolo's best vision-capable model
export const FALLBACK_MODELS = [
  "Llama-3.3-70B-Instruct",
  "Llama-3.1-8B-Instruct",
  "gemma4-31b",
  "mistral-small3.2"
];

export function getAIProvider(): 'regolo' | 'openrouter' | 'none' {
  return aiProvider;
}

export async function getApiKey(): Promise<string | null> {
  if (!apiKey) {
    console.warn("WARNING: No AI API key configured (REGOLO_API_KEY or OPENROUTER_API_KEY). AI features will be disabled.");
    return null;
  }
  return apiKey;
}

// Base URLs for each provider
const PROVIDER_BASE_URLS = {
  regolo: 'https://api.regolo.ai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions'
};

function getBaseUrl(): string {
  if (aiProvider === 'regolo') {
    return PROVIDER_BASE_URLS.regolo;
  } else if (aiProvider === 'openrouter') {
    return PROVIDER_BASE_URLS.openrouter;
  }
  throw new Error('No AI provider configured');
}

// Get provider-specific headers
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  // OpenRouter requires these headers, Regolo does not
  if (aiProvider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_URL || 'http://localhost:5173';
    headers['X-Title'] = 'Epimetheus AI';
  }
  
  return headers;
}

// AI completion function with model fallback
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
    throw new Error(`${aiProvider.toUpperCase()} API key is not configured. AI features are unavailable.`);
  }
  
  const modelsToTry = [model || DEFAULT_MODEL, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: Error | null = null;
  const baseUrl = getBaseUrl();
  const headers = getHeaders();

  for (const modelToTry of modelsToTry) {
    try {
      console.log(`Trying model: ${modelToTry} via ${aiProvider}`);
      
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
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers,
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
          throw new Error(`${aiProvider.toUpperCase()} API error: ${response.status} ${errorText}`);
        }
        
        lastError = new Error(`${aiProvider.toUpperCase()} API error: ${response.status} ${errorText}`);
        
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

// Streaming completion helper (unchanged)
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

