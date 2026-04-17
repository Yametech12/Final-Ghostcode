import 'dotenv/config';

let apiKey: string | null = null;

export async function getApiKey(): Promise<string> {
  if (!apiKey) {
    apiKey = process.env.OPENROUTER_API_KEY || '';
  }
  return apiKey;
}