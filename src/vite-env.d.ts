/// <reference types="vite/client" />
/// <reference lib="dom" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Optional: override the default `/api` base URL for the frontend
  readonly VITE_API_BASE_URL?: string;

  // reCAPTCHA (client-side site key)
  readonly VITE_RECAPTCHA_SITE_KEY?: string;

  // Google Cloud Storage (client-side bucket name only — never the secret)
  readonly VITE_GCP_BUCKET_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
