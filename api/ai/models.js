export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.REGOLO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'REGOLO_API_KEY not configured' });
    }

    // Regolo supported models
    const models = [
      {
        id: "Llama-3.3-70B-Instruct",
        name: "Llama 3.3 70B Instruct",
        description: "Latest Llama model with strong instruction-following capabilities"
      },
      {
        id: "Llama-3.1-8B-Instruct",
        name: "Llama 3.1 8B Instruct",
        description: "Efficient Llama model for fast responses"
      },
      {
        id: "gemma4-31b",
        name: "Gemma 4 31B",
        description: "Google's high-performance language model"
      },
      {
        id: "mistral-small3.2",
        name: "Mistral Small 3.2",
        description: "Compact but capable Mistral model"
      }
    ];

    res.json({
      provider: "Regolo AI",
      models: models,
      defaultModel: "Llama-3.3-70B-Instruct",
      apiEndpoint: "https://api.regolo.ai/v1/chat/completions"
    });
  } catch (error) {
    console.error("Error in models handler:", error);
    res.status(500).json({
      error: `Failed to fetch models: ${error.message}`
    });
  }
}