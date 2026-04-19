import { serializeError } from '../utils/errorHandling';

// OpenRouter model configuration - using reliable models
export const DEFAULT_MODEL = "openai/gpt-4o-mini";
// Fallback models in order of preference
export const FALLBACK_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-sonnet-latest",
  "meta-llama/llama-3.1-8b-instruct:free",
];
// Vision support enabled with OpenRouter
export const VISION_MODEL = "openai/gpt-4o-mini";

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

  let lastError: Error | null = null;

  for (const modelToTry of modelsToTry) {
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
      const response = await fetch(
        `${apiBase}/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        let errorData: { error?: { message?: string }; details?: string } = {};
        try {
          errorData = await response.json();
        } catch {}

        const errorMessage =
          errorData?.error?.message ||
          errorData?.details ||
          errorData?.error ||
          response.statusText ||
          "Unknown error";

        // If it's a 404 (model not found), try next model
        if (response.status === 404 || (typeof errorMessage === 'string' && errorMessage.includes('endpoints found'))) {
          console.warn(`Model ${modelToTry} not available, trying next model...`);
          lastError = new Error(`AI API error: ${response.status} - ${errorMessage}`);
          continue;
        }

        // For other errors, throw immediately
        throw new Error(`AI API error: ${response.status} - ${errorMessage}`);
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
        } catch (jsonError) {
          const text = await response.text();
          console.error("Invalid JSON response:", text);
          throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
        }
      }
    } catch (error) {
      lastError = error as Error;
      console.warn(`Failed with model ${modelToTry}:`, error);

      // If it's a network error or 5xx, don't try other models
      if (error instanceof Error &&
          (error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('500') ||
           error.message.includes('502') ||
           error.message.includes('503'))) {
        throw error;
      }

      // Continue to next model for 4xx errors (likely model-specific)
      continue;
    }
  }

  // If all models failed, throw the last error
  throw lastError || new Error("All AI models failed");
}