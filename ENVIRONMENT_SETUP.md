# Environment Variables Setup

## Required Variables

### Supabase
- `VITE_SUPABASE_URL` – Already configured ✅
- `VITE_SUPABASE_ANON_KEY` – Already configured ✅
- `SUPABASE_SERVICE_ROLE_KEY` – **MISSING** (get from Supabase Dashboard → Settings → API → service_role key)

### OpenRouter AI
- `OPENROUTER_API_KEY` – Already configured ✅

### Google reCAPTCHA
- `VITE_RECAPTCHA_SITE_KEY` – **MISSING** (get from Google reCAPTCHA Admin Console)

### Google Cloud Storage (Optional – only if using GCS backup)
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_BUCKET_NAME`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER_ID`

### App
- `APP_URL` – Already configured ✅
- `PORT` – Already configured ✅
- `GMAIL_USER` – Already configured ✅
- `GMAIL_APP_PASSWORD` – Already configured ✅

## Actions Needed

1. Get Supabase `service_role` key from:
   - Supabase Dashboard → Project Settings → API → `service_role` key
   - Replace `your_actual_service_role_key_here` on line 8

2. Get Google reCAPTCHA site key:
   - Visit https://www.google.com/recaptcha/admin
   - Create a reCAPTCHA v2 or v3 site
   - Copy the site key
   - Replace `your_recaptcha_site_key_here` on line 21

## Validation

The API will fail to start without these keys. After updating `.env`, run:

```bash
npm run dev
```

The backend will log clear errors if keys are missing.
