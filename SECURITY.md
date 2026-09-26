# Security Policy

Last verified: 2026-09-26

## Supported Versions

Epimetheus is deployed continuously from `main` to Vercel. There are no
maintained release branches and no tagged releases in the repository history
(`git tag` is empty as of the last verified date), so only the deployed `main`
build receives security fixes.

| Version | Supported |
| --- | --- |
| `main` (deployed) | :white_check_mark: |
| Any previous commit or pre-`main` snapshot | :x: |
| Forks and self-hosted copies | :x: (maintainers of the fork are responsible) |

## Reporting a Vulnerability

> **Before publishing this repository, replace the placeholder below with a real
> private channel.** If you leave the placeholder in place, there is no way for a
> researcher to reach you, and a disclosure policy with no reachable recipient
> is worse than none.

**Contact:** `[MAINTAINER CONTACT — TO BE FILLED IN]`

Preferred channels, in order:

1. **GitHub private vulnerability reporting** — use the repository's *Security*
   tab → *Report a vulnerability*. This keeps the report private and threaded.
2. **Email** — the address you place in the line above.

Please **do not** open a public GitHub issue for a vulnerability, and do not
post the details in any public Discord, chat, or social channel before a fix is
released.

### What to include

A useful report contains enough for us to reproduce the problem without asking
follow-up questions. Please include:

- **Summary** — one sentence on what the issue is and what it affects.
- **Affected component** — one or more of: frontend SPA (`src/`), API layer
  (`api/`), database schema / RLS policies (`supabase/migrations/`), deployment
  config (`vercel.json`, `index.html` headers), or the dependency tree.
- **Reproduction steps** — exact request (method, path, headers, body), the
  authenticated role you used (`user` or `admin`), and the observed result.
- **Impact** — what an attacker gains. Be concrete: read another user's row,
  escalate to `admin`, exfiltrate a secret, bypass a paywall, exhaust quota.
- **Proof of concept** — a `curl` command, script, or screenshot. Redact any
  real secret values and any third party's personal data.
- **Environment** — local dev (`api/_index.ts`, port 3000), Vercel preview, or
  production.
- **Suggested fix** (optional) — if you already have one.
- **Credit preference** — how you would like to be acknowledged, or "anonymous".

### What NOT to include

Never send live credentials, service-role keys, session tokens, or another
user's personal data. If a leak is the finding, report the **location** (file,
commit, endpoint) rather than pasting the secret itself.

## Response Timeline

These are targets, not contractual guarantees. This is a small project.

| Stage | Target |
| --- | --- |
| Acknowledgement that the report was received | within 3 business days |
| Initial triage and severity assessment | within 7 business days |
| Fix or documented mitigation for Critical / High | within 30 days |
| Fix or documented mitigation for Medium / Low | next planned release |
| Public disclosure (coordinated) | within 90 days of the report, or sooner by mutual agreement |

If a fix will take longer than the targets above, we will say so explicitly and
give a revised date rather than go silent. If you have not heard back within
7 business days, please re-send — assume the message was missed, not ignored.

## Scope

**In scope**

- Authentication and authorisation flaws, including any path that lets a user
  read, modify, or delete another user's data.
- Row Level Security policy gaps in `supabase/migrations/` — for example a
  missing `WITH CHECK`, a missing `WITH CHECK` on `UPDATE`, or a policy that
  allows privilege escalation via an unguarded column.
- Privilege escalation to `role = 'admin'`.
- Exposure of server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`,
  `REGOLO_API_KEY`, `OPENROUTER_API_KEY`, `STRIPE_SECRET_KEY`,
  `GMAIL_APP_PASSWORD`) to the client bundle or to an unauthenticated endpoint.
- Injection into the AI pipeline that causes server-side harm (not merely a
  rude model reply).
- Rate-limit bypass that permits unbounded cost generation.
- Server-Side Request Forgery, arbitrary file read/write, RCE.
- Vulnerabilities in dependencies that are **reachable** from application code.

**Out of scope**

- Model output quality, tone, or factual accuracy. Prompt-injection that only
  changes what the model says is a product-quality issue, not a security
  vulnerability — report it as a normal issue.
- Missing security headers on a local development server.
- Findings that require the attacker to already hold `SUPABASE_SERVICE_ROLE_KEY`
  or a valid `admin` session.
- Automated scanner output with no demonstrated impact.
- Denial of service by volume against a third party (Regolo, Supabase) — report
  to that provider.
- Social engineering of maintainers or users.
- Reports about the legacy, no-longer-authoritative SQL files
  (`supabase-schema-v2.sql`, `scripts/rls-audit.sql`,
  `scripts/create-rate-limits-table.sql`). See `docs/architecture/README.md`
  for why these are dead weight; report against
  `supabase/migrations/` instead.

## Security Controls Already in Place

Documented so you can skip reporting things that are already known and
intentional. Details and file paths are in
[`docs/security/threat-model.md`](./docs/security/threat-model.md).

- **Server-derived user identity** — every authenticated handler resolves the
  caller from the Supabase JWT. A `userId` in a request body or query string is
  never trusted.
- **Fail-closed CSRF gate** — state-changing requests must carry
  `Content-Type: application/json` or `X-Requested-With: XMLHttpRequest`.
- **CORS allow-list** — explicit origins with `Vary: Origin`; never `*`
  combined with credentials.
- **CSP without `'unsafe-inline'` in `script-src`** — see
  `api/lib/http.ts`.
- **Magic-byte image sniffing** on uploads, with a size cap and a
  JWT-derived storage path.
- **Server-side shape and length validation** of AI payloads before insert.
- **Atomic database-backed rate limiting** via the
  `record_and_count_rate_limit` RPC, which avoids the SELECT-then-INSERT race
  that an in-process counter cannot close.
- **Build-time secret guard** in `vite.config.ts` that aborts the build if a
  forbidden `VITE_`-prefixed secret name is present, or if a secret-shaped
  string appears in the emitted bundle.

## Known Accepted Risks

These are known, deliberate, and documented — please do not report them as new.
They are candidates for future work, tracked in `CHANGELOG.md` under
*Unreleased*.

- Browser session tokens are held in `localStorage` by the Supabase client
  rather than in `HttpOnly` cookies. Moving the session to cookies is a
  cross-cutting change to the auth provider and the server-side JWT validator.
- The dev Express server (`api/_index.ts`) rate-limits in process memory, so
  limits are per-instance and reset on restart. The production path uses the
  database RPC. Do not run the dev server on the public internet.
- Sentry is optional and no-ops when `VITE_SENTRY_DSN` / `SENTRY_DSN` are unset.
- `x-powered-by` is supplied by Express and is stripped by the shared header
  helper; verify per-environment rather than assuming.

## Acknowledgements

With the reporter's permission, we credit people who responsibly disclose
issues. No acknowledgements have been recorded yet.

To be listed here, say so in your report and tell us the name or handle you want
used.
