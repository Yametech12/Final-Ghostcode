import { getApiKey, DEFAULT_MODEL } from '../config.js';

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
        error: "Regolo AI API key not configured on server"
      });
    }

    // Test Regolo key with simple request
    const testBody = {
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: "Say 'Hello'" }],
      max_tokens: 10
    };

    const response = await fetch('https://api.regolo.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testBody),
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        configured: true,
        provider: "Regolo AI",
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
    console.error("Regolo AI test error:", error);
    res.status(500).json({
      configured: false,
      error: `Test failed: ${error.message}`
    });
  }
}