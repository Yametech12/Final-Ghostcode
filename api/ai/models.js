export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch models' });
    }

    const data = await response.json();

    // Filter to show only a few key models for debugging
    const freeModels = data.data?.filter((model) =>
      model.id.includes('free') ||
      model.id.includes('meta-llama') ||
      model.id.includes('microsoft/wizardlm')
    ).slice(0, 10) || [];

    const paidModels = data.data?.filter((model) =>
      model.id.includes('claude') ||
      model.id.includes('gpt-4') ||
      model.id.includes('gemini')
    ).slice(0, 5) || [];

    res.json({
      total: data.data?.length || 0,
      free_models: freeModels.map((model) => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing
      })),
      paid_models: paidModels.map((model) => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing
      })),
      recommended: [
        "meta-llama/llama-3.1-8b-instruct:free",
        "microsoft/wizardlm-2-8x22b",
        "anthropic/claude-3-haiku",
        "openai/gpt-3.5-turbo"
      ]
    });
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    res.status(500).json({
      error: `Failed to fetch models: ${error.message}`
    });
  }
}