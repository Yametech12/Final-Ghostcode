import { serializeError } from '../utils/errorHandling';
import { apiFetch } from './fetch';

/**
 * Structured error thrown when the AI proxy returns a non-OK response.
 * Pages calling chatCompletion (Decryptor, Simulation, CalibrationPage)
 * branch on `code` to surface the right UX — most importantly
 * `PAYMENT_REQUIRED` which redirects to /pricing instead of toasting a
 * raw English string. Previously we threw `new Error('AI API error: ...')`
 * with the structured info collapsed into the message, so the paywall
 * redirect was unreachable from those pages.
 */
export class AiApiError extends Error {
  status: number;
  code?: string;
  requiredTier?: 'strategist' | 'oracle';
  currentTier?: 'free' | 'strategist' | 'oracle';
  retryAfter?: number | string | null;
  requestId?: string;
  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    requiredTier?: 'strategist' | 'oracle';
    currentTier?: 'free' | 'strategist' | 'oracle';
    retryAfter?: number | string | null;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = 'AiApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.requiredTier = opts.requiredTier;
    this.currentTier = opts.currentTier;
    this.retryAfter = opts.retryAfter ?? null;
    this.requestId = opts.requestId;
  }
}

// Regolo AI model configuration — shared with api/_config.ts
// If you change models here, update api/_config.ts as well (or import from a shared module).
export const DEFAULT_MODEL = "Llama-3.3-70B-Instruct";
// Fallback models in order of preference — Llama-3.1-8B removed (invalid on Regolo)
export const FALLBACK_MODELS = [
  "Llama-3.3-70B-Instruct",
  "gemma4-31b",
  "mistral-small3.2",
];
// Vision support enabled with Regolo
export const VISION_MODEL = "Llama-3.3-70B-Instruct";

function hasImageContent(messages: any[]): boolean {
  return messages.some((m: any) => {
    if (!m.content) return false;
    if (typeof m.content === 'string') return m.content.includes('data:image') || m.content.includes('base64');
    if (Array.isArray(m.content)) {
      return m.content.some((c: any) => c.type === 'image_url' && c.image_url?.url);
    }
    return false;
  });
}

function convertToVisionFormat(messages: any[]): any[] {
  return messages.map((m: any) => {
    if (!m.content || typeof m.content !== 'string') return m;
    // Check if content contains base64 image
    const base64Match = m.content.match(/data:image\/(\w+);base64,/);
    if (base64Match) {
      return {
        ...m,
        content: [
          { type: 'text', text: m.content.replace(/data:image\/(\w+);base64,[\w+/=]+/, '').trim() },
          { type: 'image_url', image_url: { url: m.content } }
        ]
      };
    }
    return m;
  });
}

export async function chatCompletion(
  messages: any[],
  model: string = DEFAULT_MODEL,
  options: any = {}
): Promise<any> {
  // Automatically use vision model when images are present
  const hasImages = hasImageContent(messages);
  const effectiveModel = hasImages ? VISION_MODEL : model;
  
  // Convert messages to vision format if needed
  const processedMessages = hasImages ? convertToVisionFormat(messages) : messages;
  const modelsToTry = [effectiveModel, ...FALLBACK_MODELS];

  // Optional AbortSignal so callers can cancel a long-running completion.
  // Used by CalibrationPage's "Cancel" button on the scanning overlay; the
  // server-side request to Regolo continues but the client unblocks and the
  // partial result is discarded.
  const signal: AbortSignal | undefined = options.signal;

  let lastError: Error | null = null;

  for (const modelToTry of modelsToTry) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    try {
      const requestBody: any = {
        model: modelToTry,
        messages: processedMessages,
        temperature: options.temperature || 0.7,
        top_p: options.top_p || 1.0,
        stream: options.stream || false,
      };

      const maxTokens = options.max_tokens || options.config?.maxOutputTokens || 4096;
      if (maxTokens) {
        requestBody.max_tokens = maxTokens;
      }

      if (options.response_format) {
        requestBody.response_format = { type: "json_object" };
      }

      const apiBase = import.meta.env.VITE_API_BASE_URL || "/api";
      const response = await apiFetch(
        `${apiBase}/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal,
        },
      );

      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.json();
        } catch {}

        // Server returns a structured shape:
        //   { error: string, code?: string, requiredTier?, currentTier?, retryAfter?, requestId? }
        // Older endpoints sometimes nest the message under .error.message
        // or .details, so probe in priority order.
        const errorMessage =
          (typeof errorBody?.error === 'string' && errorBody.error) ||
          errorBody?.error?.message ||
          errorBody?.details ||
          response.statusText ||
          "Unknown error";
        const code = typeof errorBody?.code === 'string' ? errorBody.code : undefined;
        const requiredTier = errorBody?.requiredTier;
        const currentTier = errorBody?.currentTier;
        const retryAfter = errorBody?.retryAfter ?? null;
        const requestId = typeof errorBody?.requestId === 'string' ? errorBody.requestId : undefined;

        // 402 PAYMENT_REQUIRED is the tier gate's "you need to upgrade"
        // response. Don't treat it as a model-availability problem — fail
        // fast so the calling page can redirect to /pricing.
        if (response.status === 402 || code === 'PAYMENT_REQUIRED') {
          throw new AiApiError({
            status: response.status,
            message: errorMessage,
            code: code ?? 'PAYMENT_REQUIRED',
            requiredTier,
            currentTier,
            retryAfter,
            requestId,
          });
        }

        // 429 rate-limited shouldn't fall through the model rotation —
        // every model would hit the same limit. Surface immediately.
        if (response.status === 429 || code === 'RATE_LIMITED' || code === 'USER_RATE_LIMITED') {
          throw new AiApiError({
            status: response.status,
            message: errorMessage,
            code: code ?? 'RATE_LIMITED',
            retryAfter,
            requestId,
          });
        }

        // 504 (AI_TIMEOUT) and 503 (MODEL_UNAVAILABLE) — try next model.
        if (response.status === 504 || response.status === 503 || code === 'AI_TIMEOUT' || code === 'MODEL_UNAVAILABLE') {
          console.warn(`Model ${modelToTry} timed out or unavailable (${response.status}), trying next model...`);
          lastError = new AiApiError({
            status: response.status,
            message: errorMessage,
            code: code ?? (response.status === 504 ? 'AI_TIMEOUT' : 'MODEL_UNAVAILABLE'),
            requestId,
          });
          continue;
        }

        // If it's a 404 (model not found), try next model
        if (response.status === 404 || (typeof errorMessage === 'string' && errorMessage.includes('endpoints found'))) {
          console.warn(`Model ${modelToTry} not available, trying next model...`);
          lastError = new AiApiError({
            status: response.status,
            message: `${errorMessage}`,
            code: code ?? 'MODEL_UNAVAILABLE',
            requestId,
          });
          continue;
        }

        // For other errors, throw immediately with structured info preserved.
        throw new AiApiError({
          status: response.status,
          message: errorMessage,
          code,
          requiredTier,
          currentTier,
          retryAfter,
          requestId,
        });
      }

      console.log(`Successfully using model: ${modelToTry}`);

      if (options.stream) {
        return (async function* () {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder("utf-8");
          if (!reader) return;

          let buffer = "";
          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                  try {
                    const data = JSON.parse(line.slice(6));
                    yield data;
                  } catch (e) {
                    console.error("Error parsing stream chunk", serializeError(e));
                  }
                }
              }
            } catch (e) {
              console.error("Error reading stream chunk", serializeError(e));
              break;
            }
          }
        })();
      } else {
        try {
          return await response.json();
        } catch (_jsonError) {
          const text = await response.text();
          console.error("Invalid JSON response:", text);
          throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
        }
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed with model ${modelToTry}:`, error);

      // Caller-initiated cancellation — bubble up immediately, don't try
      // fallback models.
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Structured AiApiError handling — paywall and rate limits should
      // never trigger fallback rotation, since every model hits the same
      // gate. Bubble these up immediately so the calling page can route
      // the user appropriately.
      if (error instanceof AiApiError) {
        if (
          error.code === 'PAYMENT_REQUIRED' ||
          error.code === 'RATE_LIMITED' ||
          error.code === 'USER_RATE_LIMITED' ||
          error.code === 'UNAUTHORIZED' ||
          error.code === 'CSRF_CHECK_FAILED'
        ) {
          throw error;
        }
        if (error.code === 'MODEL_UNAVAILABLE' || error.code === 'AI_TIMEOUT') {
          continue;
        }
      }

      // Network errors and 5xx (other than 503) shouldn't try other
      // models — they're not model-specific. 503 means "this model is
      // momentarily unavailable", which is exactly what the fallback
      // chain is for, so we DO continue on 503.
      if (error instanceof Error) {
        const msg = error.message;
        if (msg.includes('503') || msg.includes('MODEL_UNAVAILABLE')) {
          // try next model
          continue;
        }
        if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('500') ||
          msg.includes('502')
        ) {
          throw error;
        }
      }

      // Continue to next model for 4xx errors (likely model-specific)
      continue;
    }
  }

  // If all models failed, throw the last error
  throw lastError || new Error("All AI models failed");
}
