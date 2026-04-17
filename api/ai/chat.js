import { getApiKey } from '../config.js';
import { AI_PROVIDER, API_URL } from '../services/ai.js';

const FALLBACK_MODELS = [
  "microsoft/wizardlm-2-8x22b",
  "meta-llama/llama-3.1-8b-instruct:free",
  "anthropic/claude-3-haiku",
  "openai/gpt-3.5-turbo",
  "google/gemma-2-9b-it:free"
];

async function chatWithOpenRouter(body, apiKeyVal, retries = 3, delay = 1000) {
  const url = API_URL;
  const modelsToTry = body.model ? [body.model] : FALLBACK_MODELS;

  let lastError = null;

  for (const modelToTry of modelsToTry) {
    console.log(`Trying OpenRouter model: ${modelToTry}`);

    const requestBody = {
      model: modelToTry,
      messages: body.messages || [],
      temperature: body.temperature || 0.7,
      top_p: body.top_p || 1.0,
      max_tokens: body.max_tokens || 4096,
      stream: body.stream || false
    };

    console.log('OpenRouter Request:', {
      url,
      model: requestBody.model,
      messageCount: requestBody.messages?.length || 0,
      hasApiKey: !!apiKeyVal,
      isFallback: modelToTry !== body.model
    });

    const headers = {
      'Authorization': `Bearer ${apiKeyVal}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://epimetheus.ai',
      'X-Title': process.env.OPENROUTER_TITLE || 'Epimetheus'
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          console.log(`Successfully using OpenRouter model: ${modelToTry}`);
          return response;
        }

        const errorData = await response.json().catch(() => ({}));
        console.error(`OpenRouter API Error (${response.status}) for model ${modelToTry}:`, errorData);

        // If 404 (model not found) or 400 (invalid model), try next model
        if (response.status === 404 || response.status === 400) {
          console.warn(`Model ${modelToTry} not available, trying next model...`);
          lastError = new Error(`HTTP ${response.status}: ${errorData.error?.message || errorData.message || response.statusText}`);
          break; // Break retry loop and try next model
        }

        // For rate limits, retry
        if (response.status === 429 && attempt < retries) {
          const wait = delay * Math.pow(2, attempt - 1);
          console.warn(`Rate limit (429), waiting ${wait}ms before retry ${attempt}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }

        // For other errors, don't retry with this model
        const errorMsg = errorData.error?.message || errorData.message || response.statusText || 'Unknown error';
        lastError = new Error(`HTTP ${response.status}: ${errorMsg}`);
        break;

      } catch (error) {
        if (attempt === retries) {
          lastError = error;
          console.warn(`All retries failed for model ${modelToTry}:`, error);
          break;
        }
        console.warn(`Attempt ${attempt} failed for model ${modelToTry}, retrying:`, error);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }

    // If we get here, this model failed, continue to next model
  }

  // If all models failed, throw the last error
  throw lastError || new Error('All OpenRouter models failed');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log("AI chat request received via OpenRouter");

  try {
    const key = await getApiKey();
    if (!key) {
      console.error("OpenRouter API key missing");
      return res.status(500).json({ error: "OpenRouter API key not configured on server." });
    }

    console.log("OpenRouter API key found, provider:", AI_PROVIDER);

    const body = req.body;

    // Image/vision support - pass through as-is (OpenRouter handles it)
    const hasImages = Array.isArray(body.messages) && body.messages.some((m) => {
      if (typeof m.content !== 'object') return false;
      return Array.isArray(m.content) && m.content.some((c) => c.type === "image_url");
    });

    console.log("Vision detection:", { hasImages, messagesCount: body.messages?.length || 0 });

    const response = await chatWithOpenRouter(body, key);

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        res.status(500).json({ error: 'Streaming not supported by response' });
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              const data = line.slice(6);
              if (data.trim()) res.write(`data: ${data}\n\n`);
            }
          }
        }
        res.write('data: [DONE]\n\n');
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        reader.releaseLock();
      }
      res.end();
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error("OpenRouter proxy error:", error);
    const errorMsg = error.message;
    res.status(500).json({ error: `AI API error: ${errorMsg}` });
  }
}