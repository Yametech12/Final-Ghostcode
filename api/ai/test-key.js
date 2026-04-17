import { getApiKey } from '../config.js';
import { AI_PROVIDER, API_URL } from '../services/ai.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const key = await getApiKey();
    const hasKey = !!key;

    if (!hasKey) {
      return res.status(200).json({
        configured: false,
        error: "AI API key not configured on server"
      });
    }

    // Test OpenRouter key with simple request
    const testBody = {
      model: "microsoft/wizardlm-2-8x22b",
      messages: [{ role: "user", content: "Say 'Hello'" }],
      max_tokens: 10
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://epimetheus.ai',
        'X-Title': process.env.OPENROUTER_TITLE || 'Epimetheus'
      },
      body: JSON.stringify(testBody),
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        configured: true,
        provider: AI_PROVIDER,
        model: data.model || 'unknown'
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      res.status(200).json({
        configured: false,
        error: `API test failed: ${response.status} - ${errorData.error?.message || response.statusText}`
      });
    }
  } catch (error) {
    console.error("OpenRouter test error:", error);
    res.status(500).json({
      configured: false,
      error: `Test failed: ${error.message}`
    });
  }
}