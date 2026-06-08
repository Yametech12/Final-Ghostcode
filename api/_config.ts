import "dotenv/config";

const apiKey: string | null = process.env.REGOLO_API_KEY || null;

// Regolo AI models (from https://docs.regolo.ai/)
export const DEFAULT_MODEL = "Llama-3.3-70B-Instruct";
export const VISION_MODEL = "Llama-3.3-70B-Instruct";
export const FALLBACK_MODELS = [
  "Llama-3.3-70B-Instruct",
  "gemma4-31b",
  "mistral-small3.2",
];

export async function getApiKey(): Promise<string | null> {
  if (!apiKey) {
    console.warn("WARNING: No REGOLO_API_KEY configured. AI features will be disabled.");
    return null;
  }
  return apiKey;
}

const BASE_URL = 'https://api.regolo.ai/v1/chat/completions';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
}

// AI completion function with model fallback
//
// Hard wall-clock budget: even with retries and fallbacks, give up after
// MAX_TOTAL_MS so we don't burn the entire Vercel function budget on a
// single hung upstream. The per-attempt fetch is also wrapped in
// AbortSignal.timeout to free socket resources promptly.
//
// PER_ATTEMPT_MS applies to non-streaming requests and covers the full
// request/response cycle. For streaming requests we use STREAM_CONNECT_MS
// instead — it's a longer wall-clock budget for getting the headers back,
// after which the underlying ReadableStream is returned to the caller and
// no more abort fires. Without that split, AbortSignal.timeout would still
// be attached to the socket while the caller is iterating the stream and
// would tear it down mid-generation around the PER_ATTEMPT_MS mark, cutting
// off the AI reply silently.
//
// Budget rationale: the Vercel function is capped at 30s (vercel.json).
// We give the primary model a generous PER_ATTEMPT_MS so big structured
// prompts (Oracle calibration) don't time out and prematurely fall over
// to a smaller model. MAX_TOTAL_MS leaves room for one fallback attempt
// before the platform timeout kicks in.
const MAX_TOTAL_MS = 55_000;     // total allowed across all attempts (Vercel cap = 60s)
const PER_ATTEMPT_MS = 50_000;   // single non-streaming fetch wall-clock
const STREAM_CONNECT_MS = 20_000; // streaming: time to get headers; body untimed

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
    throw new Error(`Regolo API key is not configured. AI features are unavailable.`);
  }
  
  const modelsToTry = [model || DEFAULT_MODEL, ...FALLBACK_MODELS.filter(m => m !== model)];
  let lastError: Error | null = null;
  const headers = getHeaders();
  const startedAt = Date.now();

  for (const modelToTry of modelsToTry) {
    if (Date.now() - startedAt > MAX_TOTAL_MS) {
      console.warn(`Total AI budget (${MAX_TOTAL_MS}ms) exhausted, aborting model loop`);
      break;
    }
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
        if (Date.now() - startedAt > MAX_TOTAL_MS) break;

        // For streaming, we only want a connect-phase timeout — once headers
        // come back we hand the body to the caller and it's their job to
        // bound the stream lifetime. Otherwise the same AbortSignal would
        // tear down the socket mid-generation. For non-streaming, the
        // signal covers the full request/response cycle.
        const attemptTimeoutMs = stream ? STREAM_CONNECT_MS : PER_ATTEMPT_MS;
        // AbortSignal.timeout was added in Node 17.3 / available on Vercel.
        // Falls back to manual AbortController for older runtimes.
        let abortTimer: ReturnType<typeof setTimeout> | undefined;
        const signal: AbortSignal =
          typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(attemptTimeoutMs)
            : (() => {
                const c = new AbortController();
                abortTimer = setTimeout(() => c.abort(), attemptTimeoutMs);
                return c.signal;
              })();

        let response: Response;
        try {
          response = await fetch(BASE_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal,
          });
        } catch (fetchErr: any) {
          if (abortTimer) clearTimeout(abortTimer);
          if (fetchErr?.name === 'AbortError' || fetchErr?.name === 'TimeoutError') {
            lastError = new Error(`Regolo request timed out after ${attemptTimeoutMs}ms`);
            console.warn(`Model ${modelToTry} attempt ${attempt}/3 timed out`);
            // Try next attempt or next model
            if (attempt < 3) continue;
            break;
          }
          throw fetchErr;
        }

        if (response.ok) {
          console.log(`Success with model: ${modelToTry}`);
          if (stream) {
            // Manual fallback path only: clear the connect timer now so it
            // can't fire while the caller is iterating the body. With
            // AbortSignal.timeout the platform manages this automatically,
            // but the timeout is still active until the signal listeners
            // are GC'd. The browser/Node implementations correctly don't
            // abort an already-fulfilled response — confirmed in spec.
            if (abortTimer) clearTimeout(abortTimer);
            return response.body;
          }
          // Non-streaming: clear our manual fallback timer (if any) so it
          // doesn't fire after json() resolves.
          if (abortTimer) clearTimeout(abortTimer);
          const data = await response.json();
          return data;
        }
        if (abortTimer) clearTimeout(abortTimer);

        const errorText = await response.text();
        console.warn(`Model ${modelToTry} failed (attempt ${attempt}/3): ${response.status}`, errorText.substring(0, 200));

        if (response.status === 429 && attempt < 3) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
          const wait = Math.max(retryAfter * 1000, 1000 * Math.pow(2, attempt - 1));
          // Don't retry if the wait would push us past the global budget.
          if (Date.now() - startedAt + wait > MAX_TOTAL_MS) {
            console.warn(`Skipping retry: would exceed ${MAX_TOTAL_MS}ms budget`);
            lastError = new Error(`Regolo rate limited; budget exhausted`);
            break;
          }
          console.warn(`Rate limited, waiting ${wait}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }

        if (response.status === 401 || response.status === 402 || response.status === 403) {
          throw new Error(`Regolo API error: ${response.status} ${errorText}`);
        }

        lastError = new Error(`Regolo API error: ${response.status} ${errorText}`);

        if (response.status === 400 || response.status === 404) {
          break;
        }

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

