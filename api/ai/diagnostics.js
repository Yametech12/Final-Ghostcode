export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (typeof AbortController === 'undefined') {
    global.AbortController = class AbortController {
      constructor() {
        this.signal = {
          aborted: false,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        };
      }
      abort() {
        this.signal.aborted = true;
      }
    };
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        has_regolo_key: !!process.env.REGOLO_API_KEY,
        api_provider: 'Regolo AI',
        vercel_env: process.env.VERCEL_ENV || 'unknown',
        vercel_region: process.env.VERCEL_REGION || 'unknown'
      },
      api_endpoints: {
        chat: '/api/ai/chat',
        test_key: '/api/ai/test-key',
        models: '/api/ai/models'
      }
    };

    // Test Regolo API key configuration
    try {
      const { getApiKey } = await import('../config.js');
      const apiKey = await getApiKey();
      diagnostics.api_key_config = {
        has_key: !!apiKey,
        key_length: apiKey?.length || 0,
        key_prefix: apiKey?.substring(0, 10) || null,
        source: 'environment'
      };
    } catch (keyError) {
      diagnostics.api_key_config = {
        error: keyError.message
      };
    }

    // Test a simple chat request if API key is available
    if (diagnostics.api_key_config?.has_key) {
      try {
        const { getApiKey, DEFAULT_MODEL } = await import('../config.js');
        const apiKey = await getApiKey();

        if (apiKey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const testResponse = await fetch('https://api.regolo.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: DEFAULT_MODEL,
              messages: [{ role: "user", content: "Say 'Hello' in one word." }],
              max_tokens: 5
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          diagnostics.chat_test = {
            status: testResponse.status,
            ok: testResponse.ok,
            statusText: testResponse.statusText,
            headers: Object.fromEntries(testResponse.headers.entries())
          };

          if (testResponse.ok) {
            const responseData = await testResponse.json();
            diagnostics.chat_test.response = {
              model: responseData.model,
              choices_count: responseData.choices?.length || 0,
              first_choice: responseData.choices?.[0]?.message?.content || null
            };
          } else {
            const errorData = await testResponse.json().catch(() => ({}));
            diagnostics.chat_test.error = errorData;
          }
        }
      } catch (chatError) {
        diagnostics.chat_test = {
          error: chatError.message
        };
      }
    }

    res.json(diagnostics);
  } catch (error) {
    console.error("Diagnostics error:", error);
    res.status(500).json({
      error: `Diagnostics failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}