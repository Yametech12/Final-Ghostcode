/// <reference types="vite/client" />
/// <reference lib="dom" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Optional: override the default `/api` base URL for the frontend
  readonly VITE_API_BASE_URL?: string;

  // Sentry (optional client-side DSN)
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
