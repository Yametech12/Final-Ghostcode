export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        has_openrouter_key: !!process.env.OPENROUTER_API_KEY,
        api_provider: process.env.AI_PROVIDER || 'openrouter',
        openrouter_referer: process.env.OPENROUTER_REFERER || 'https://epimetheus.ai',
        openrouter_title: process.env.OPENROUTER_TITLE || 'Epimetheus',
        vercel_env: process.env.VERCEL_ENV || 'unknown',
        vercel_region: process.env.VERCEL_REGION || 'unknown'
      },
      api_endpoints: {
        chat: '/api/ai/chat',
        test_key: '/api/ai/test-key',
        models: '/api/ai/models'
      }
    };

    // Test OpenRouter models endpoint
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      diagnostics.models_endpoint = {
        status: modelsResponse.status,
        ok: modelsResponse.ok,
        headers: Object.fromEntries(modelsResponse.headers.entries())
      };

      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        diagnostics.models_info = {
          total_models: modelsData.data?.length || 0,
          sample_free_models: modelsData.data?.filter((m) => m.id.includes('free')).slice(0, 3) || [],
          sample_paid_models: modelsData.data?.filter((m) => !m.id.includes('free')).slice(0, 3) || []
        };
      }
    } catch (modelsError) {
      diagnostics.models_endpoint = {
        error: modelsError.message
      };
    }

    // Test API key configuration
    try {
      const { getApiKey } = await import('../config.js');
      const apiKey = await getApiKey();
      diagnostics.api_key_config = {
        has_key: !!apiKey,
        key_length: apiKey?.length || 0,
        key_prefix: apiKey?.substring(0, 10) || null,
        source: process.env.OPENROUTER_API_KEY ? 'environment' : 'firestore'
      };
    } catch (keyError) {
      diagnostics.api_key_config = {
        error: keyError.message
      };
    }

    // Test a simple chat request if API key is available
    if (diagnostics.api_key_config?.has_key) {
      try {
        const { getApiKey } = await import('../config.js');
        const { API_URL } = await import('../services/ai.js');
        const apiKey = await getApiKey();

        if (apiKey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const testResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': diagnostics.environment.openrouter_referer,
              'X-Title': diagnostics.environment.openrouter_title
            },
            body: JSON.stringify({
              model: "microsoft/wizardlm-2-8x22b",
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