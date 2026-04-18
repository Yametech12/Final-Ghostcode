import "dotenv/config";

let apiKey: string | null = null;

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

// AI completion function for OpenRouter
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

  const payload: any = {
    model,
    messages,
    temperature,
    max_tokens,
    stream
  };

  if (response_format) {
    payload.response_format = response_format;
  }

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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
  }

  if (stream) {
    return response.body; // Return readable stream
  }

  const data = await response.json();
  return data;
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
  const stream = await createCompletion({
    model,
    messages,
    temperature,
    response_format,
    max_tokens,
    stream: true
  });

  const reader = (stream as ReadableStream).getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            console.error('Failed to parse streaming chunk:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

