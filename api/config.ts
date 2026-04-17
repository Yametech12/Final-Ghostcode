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