# Stripe Billing — Setup & Operations Guide

Status: **implemented, not yet live** — this guide covers everything needed to
turn it on. The integration is Vite + Express/Vercel (NOT Next.js), so env
prefixes and deployment steps below are Vite-specific.

---

## 1. Architecture overview

```
                        ┌────────────────────────── Vercel ──────────────────────────┐
PricingPage.tsx ──POST──▶ /api/billing/create-checkout-session  (JWT required)        │
ProfilePage.tsx ──POST──▶ /api/billing/create-portal-session    (JWT required)        │
                        │        │                                                     │
Stripe.com ◀──redirect──┘        ▼                                                     │
    │                      stripe.checkout.sessions.create()                            │
    │                       or billingPortal.sessions.create()                          │
    │                                                                                   │
    └──POST──▶ /api/billing/webhook  ◀── RAW BODY ONLY (bodyParser: false on Vercel,    │
                  │                       express.raw() BEFORE express.json on Express) │
                  ▼                                                                      │
            verifyStripeSignature()  ── HMAC check against STRIPE_WEBHOOK_SECRET         │
                  ▼                                                                      │
            stripe_events INSERT (ON CONFLICT DO NOTHING)  ── idempotency ledger         │
                  ▼                                                                      │
            users.subscription_tier / subscription_expires_at /                          │
            billing_grace_period_until   ── then invalidateTierCache()                   │
            └────────────────────────────────────────────────────────────────────────────┘
```

Files:

| File | Purpose |
|---|---|
| `api/lib/stripe.ts` | SDK bootstrap (lazy, graceful 503 when unconfigured), raw-body signature verification, price→tier mapping |
| `api/lib/subscription.ts` | The three billing handlers + webhook event routing |
| `supabase/migrations/20240101001200_stripe_billing.sql` | New columns + `stripe_events` idempotency table |
| `src/lib/billing.ts` | Typed client wrapper (JWT + CSRF header via `apiFetch`) |
| `src/components/billing/*` | `PricingButton`, `CustomerPortalButton`, `BillingStatus`, `BillingActions`, `StripeError` |

**tierGate.ts is untouched.** It remains the single enforcement point: it
reads `users.subscription_tier` + `subscription_expires_at` server-side, which
is exactly what the webhook writes. A `strategist`/`oracle` user passes the
gate regardless of how the tier got there (manual grant, webhook, admin).

---

## 2. Env setup

Add to `.env` (never commit it — see `.env.example` for the annotated version):

```bash
STRIPE_SECRET_KEY=sk_test_...            # server-only. NEVER VITE_-prefixed
STRIPE_WEBHOOK_SECRET=whsec_...          # from `stripe listen` or the dashboard endpoint
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Vite exposes ONLY VITE_* to the client
STRIPE_PRICE_STRATEGIST=price_...        # recurring price for strategist
STRIPE_PRICE_ORACLE=price_...            # recurring price for oracle
APP_URL=https://epimetheus.ai            # checkout success/cancel redirect base
```

> **Why `VITE_` and not `NEXT_PUBLIC_`?** This project is built with **Vite**,
> which only inlines env vars prefixed `VITE_` into the client bundle.
> `NEXT_PUBLIC_` is a Next.js convention — here it would be silently `undefined`
> in the browser. `.env.example` ships both spellings with this warning; the
> Vite secret-leak guard in `vite.config.ts` fails the build if anyone adds
> `VITE_STRIPE_SECRET*` (the secret key must stay server-side).

Create the two recurring prices in the Stripe dashboard
(**Product catalog → Add product → recurring price**) and copy their
`price_...` IDs into the env vars. The webhook maps a subscription's price ID
back to a tier through these two variables — an unknown price is logged and
**ignored, never guessed**.

---

## 3. Database migration

Apply before deploying the code (the webhook needs the new columns):

```bash
supabase db push            # or run the file in the SQL editor
# verify:
psql ... -c "\d users"                 # expect stripe_customer_id, stripe_subscription_id,
                                       # billing_grace_period_until
psql ... -c "\d stripe_events"         # expect id PK, type, payload, processed_at
```

`stripe_events` has RLS enabled and **no policies** — only the service-role
key (used by the API) can touch it. Anonymous/authenticated roles see nothing.

---

## 4. Local testing with stripe-cli

```bash
# Terminal 1 — app (Express on :3000, Vite on :5173)
npm run dev

# Terminal 2 — forward Stripe events to the local webhook
stripe listen --forward-to localhost:3000/api/billing/webhook
# → prints "Ready! Your webhook signing secret is whsec_..." —
#   put THAT value in .env as STRIPE_WEBHOOK_SECRET

# Terminal 3 — trigger the flow
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

Full end-to-end purchase test with a test card:

1. Sign in, go to `/pricing`, click **Upgrade**.
2. Pay with the test card `4242 4242 4242 4242` (any future expiry, any CVC).
3. You land on `/profile?billing=success`; `BillingStatus` shows the new tier
   and renewal date.
4. In the `stripe listen` terminal you should see
   `checkout.session.completed` → `200 OK`, and `stripe_events` gains a row.
5. Re-deliver the same event (`stripe events resend evt_...`) → response is
   `{"received":true,"duplicate":true}` and **no second tier write happens**.

Useful test cards: `4000 0000 0000 0341` (attaches but fails payment →
`invoice.payment_failed` path), `4000 0000 0000 9995` (declined).

`stripe_events` grows one row per processed event — prune it periodically if
volume makes that matter (nothing reads it back; it's a ledger).

---

## 5. Webhook endpoint (production)

1. Stripe dashboard → **Developers → Webhooks → Add endpoint**.
   - URL: `https://epimetheus.ai/api/billing/webhook`
   - Events: `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_failed`
2. Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` on
   Vercel.

`[SCREENSHOT PLACEHOLDER — insert screenshot of the Stripe "Add endpoint"
dialog with the four selected events]`

`[SCREENSHOT PLACEHOLDER — insert screenshot of the webhook signing secret
reveal dialog ("Click to reveal" → whsec_...)]`

Verify after deploy:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://epimetheus.ai/api/billing/webhook
# expect 400 — POSTing without a Stripe-Signature must be rejected
```

---

## 6. Event-handling contract

| Event | Action | Tier downgraded immediately? |
|---|---|---|
| `checkout.session.completed` (paid) | Set tier from session metadata, `subscription_expires_at` = now + 30 days (first reconcile pins the real period end), store customer + subscription IDs | — |
| `customer.subscription.updated` | Reconcile tier from price ID; expiry = `current_period_end`; non-active statuses mirror to free | Only when Stripe says the sub is no longer active/trialing/past_due |
| `customer.subscription.deleted` | Tier → `free`, expiry + grace cleared | Yes |
| `invoice.payment_failed` | Set `billing_grace_period_until` = now + 3 days | **No** — grace period; Stripe retries, a later event decides the final state |

Idempotency: the event ID is inserted into `stripe_events` (unique PK,
`ON CONFLICT DO NOTHING`) **before** processing. A duplicate delivery claims
no row → ACK'd with `duplicate: true`, zero side effects. If processing
throws, the claim is **deleted** so Stripe's automatic retry can re-process.

---

## 7. Deployment step-by-step

1. **Supabase first**: apply `20240101001200_stripe_billing.sql`
   (Section 3). The new code tolerates the columns being absent at read time,
   but the webhook writes will fail until the migration lands.
2. **Merge the patch** on a branch, verify locally:
   `npm ci && npm run lint:all && npm test && npm run build`.
3. **Stripe dashboard**: create the two recurring prices; create the webhook
   endpoint; copy `price_*` and `whsec_*` values.
4. **Vercel → Project → Settings → Environment Variables**: add
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STRATEGIST`,
   `STRIPE_PRICE_ORACLE`, and (optionally, for the client)
   `VITE_STRIPE_PUBLISHABLE_KEY` for Production + Preview.
5. **Deploy** (`git push` / Vercel UI).
6. **Verify in prod**:
   - `POST /api/billing/webhook` without signature → `400` (Section 5).
   - Buy with test-mode keys… actually verify with **live-mode keys only
     after** the Stripe account is activated; until then toggle the Vercel
     env vars to test values and buy with `4242…`.
   - Dashboard → Webhooks → endpoint shows succeeding deliveries.
7. **Go live**: swap `sk_test`→`sk_live`, `pk_test`→`pk_live`, test prices →
   live prices, create a **live** webhook endpoint, redeploy.

Rollback: the patch is additive. `git revert` the billing commit (or
`git apply -R stripe-billing.patch`) and the app returns to the pre-billing
state — no data migration is destructive.

---

## 8. Files changed

New: `api/lib/stripe.ts`, `api/lib/subscription.ts`, `api/lib/stripe.test.ts`,
`supabase/migrations/20240101001200_stripe_billing.sql`,
`src/lib/billing.ts`, `src/components/billing/{PricingButton,CustomerPortalButton,BillingStatus,BillingActions,StripeError}.tsx`,
`src/components/billing/__tests__/PricingButton.test.tsx`, `docs/BILLING.md`.

Modified: `api/_index.ts` (webhook raw route + billing routes),
`api/server.ts` (bodyParser off + raw body parse + billing routes),
`src/pages/PricingPage.tsx` (live checkout), `src/pages/ProfilePage.tsx`
(BillingActions), `.env.example` (Stripe section), `package.json` +
`package-lock.json` (`stripe` dependency).
