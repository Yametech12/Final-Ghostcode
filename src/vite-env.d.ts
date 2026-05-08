/// <reference types="vite/client" />
/// <reference lib="dom" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  
  // OpenRouter API
  readonly VITE_OPENROUTER_API_KEY: string;
  
  // Regolo AI API
  readonly VITE_REGOLO_API_KEY: string;
  readonly VITE_REGOLO_ENDPOINT: string;
  
  // Google Cloud Storage
  readonly VITE_GCP_BUCKET_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
