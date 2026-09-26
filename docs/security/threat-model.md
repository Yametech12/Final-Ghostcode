# Security Threat Model

**Last verified: 2026-09-26** · against commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f` (2026-09-12)

This document enumerates what the system holds, what could go wrong, and which
controls are actually in force. **It is deliberately not a list of strengths.**

> **Read this first.** Several controls below are documented as *present in the
> codebase but not in force*, because the patches that implement them are not
> applied to `main`, or because the audit found the control inert. Every such
> item is marked. A threat model that assumes a control is running when it is not
> is worse than no threat model.

---

## 1. Assets

Ranked by the damage that follows from disclosure.

| # | Asset | Where | Why it matters |
| --- | --- | --- | --- |
| 1 | **`dossiers`** | Postgres | Contains data about **third parties who never consented** — names, relationship phases, personal notes. This is the highest-liability data in the system and it is about people who cannot exercise any right over it. |
| 2 | **Server secrets** | Env | `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. `REGOLO_API_KEY` authorises billable inference. `STRIPE_SECRET_KEY`, `GMAIL_APP_PASSWORD` follow. |
| 3 | **`advisor_messages`** | Postgres | Full conversation text. Users disclose real relationship problems here. |
| 4 | **`oracle_analyses`** | Postgres | Free-text scenario descriptions — the same disclosures in structured form. |
| 5 | **`users`** | Postgres | Email, display name, bio, `contact_info` JSONB. |
| 6 | **Session tokens** | Browser `localStorage` | Full account access for the token's lifetime. |
| 7 | **Uploaded photos** | Storage | Faces, in a public bucket at deterministic paths *(see T-06)*. |
| 8 | **`verification_codes`** | Postgres | Short-lived numeric codes — a 6-digit space is brute-forceable if unthrottled. |
| 9 | **Admin capability** | `users.role` | Full read/delete over other users. |
| 10 | **AI quota** | Regolo account | Directly billable. Theft of quota is quiet and costs money. |

---

## 2. Trust boundaries

```
┌─ UNTRUSTED ─────────────────────────────────────────────────────────┐
│  Browser (all of it: DOM, localStorage, JS, network tab)            │
│  Every request body, query param, header, and uploaded byte         │
│  AI model output — treat as untrusted input, never as a value       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  ▼ BOUNDARY 1: JWT verification
┌─ SEMI-TRUSTED ───────────────▼──────────────────────────────────────┐
│  api/ handlers — trusted to enforce, but must re-derive identity    │
│  and re-validate every field. The service-role Supabase client      │
│  lives here and bypasses RLS, so this layer IS the security boundary│
└──────────────────────────────┬──────────────────────────────────────┘
                               │  ▼ BOUNDARY 2: RLS (only for anon-key paths)
┌─ TRUSTED ────────────────────▼──────────────────────────────────────┐
│  Supabase Postgres with RLS · Storage policies · Vercel env secrets │
└─────────────────────────────────────────────────────────────────────┘
                               │  ▼ BOUNDARY 3: third-party egress
┌─ EXTERNAL ───────────────────▼──────────────────────────────────────┐
│  Regolo AI · OpenRouter · Sentry · Stripe · Google (OAuth, GCS)     │
└─────────────────────────────────────────────────────────────────────┘
```

**Boundary 2 does not protect the API.** The API uses the service role, which
bypasses RLS. If a handler forgets an ownership filter, RLS will not catch it.
RLS protects the *direct* client-to-Supabase path; the handler is responsible for
its own authorisation. Treating RLS as a backstop for handler bugs is a mistake
that this architecture makes easy to make.

---

## 3. Threat enumeration

Status legend: **IN FORCE** · **PRESENT BUT NOT IN FORCE** (patch exists, not
applied) · **NOT IMPLEMENTED** · **PARTIAL**.

### T-01 — Credential exposure via git history
**Critical · IN FORCE (the exposure), NOT STARTED (the purge)**

Live keys — Regolo, OpenRouter, Supabase service role, a Gmail app password —
were committed in `.env` files. Analysis of the patch produced for this item puts
the commit window at **2026-04-17 → 2026-05-20**, with the affected variables
including `REGOLO_API_KEY`, `VITE_REGOLO_API_KEY`, `OPENROUTER_API_KEY`,
`VITE_OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GMAIL_APP_PASSWORD`.

**Why it matters even after the files are deleted.** Git history is permanent.
Anyone who cloned, forked, mirrored, or scraped the repository has the values
forever. Deleting the file removes the *reminder*, not the *exposure*.

**Required response, in order:**

1. **Rotate every exposed credential.** This is the only step that actually ends
   the exposure. It is an owner action; no commit performs it. Runbook:
   [`secrets-rotation.md`](./secrets-rotation.md).
2. Purge history with `git filter-repo` (dry-run first).
3. Open a GitHub support ticket to clear cached objects — a force-push does not.
4. Tell every collaborator to re-clone; their local copies still contain the
   secrets and their next push would restore them.
5. Enable GitHub Secret Scanning and Push Protection.
6. Add secret scanning to CI (`.gitleaks.toml` + pre-commit config were produced
   by the audit patch).

> **A gitleaks scan of the full history found 70 leaks.** With custom rules for
> the project's own key shapes. Until step 1 is done, every other control in this
> document is defending a door that is already open.

---

### T-02 — Missing security headers on the production document
**Critical · PRESENT BUT NOT IN FORCE**

`vercel.json` in `main` has **no `headers` block**. The HTML ships without
Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, or
Referrer-Policy.

Consequences: clickjacking is possible (no `X-Frame-Options`), and there is no
second line of defence if an injection lands. HSTS absence means a first-visit
downgrade is not prevented at the app layer.

A `vercel.json` headers block covering `/(.*)`, plus a single header source of
truth in `api/lib/http.ts`, was produced by the audit patch. It is verified in
that patch's own environment and **not applied to `main`**.

**Verify what is actually live, do not infer it:**

```bash
curl -sI https://<your-domain>/ | grep -iE 'content-security-policy|strict-transport|x-frame|referrer-policy'
```

---

### T-03 — CSP blocks the application's own inline script
**Critical · IN FORCE (as a break), PRESENT BUT NOT IN FORCE (the fix)**

The CSP excludes `'unsafe-inline'` from `script-src` — correct. But `index.html`
contains an inline theme-bootstrap `<script>` that runs before React hydrates to
prevent a flash of the wrong theme.

**In production the CSP blocks that script.** The theme bootstrap does not run,
so a returning user with a saved light-theme preference gets a dark flash before
hydration corrects it.

This is the most instructive finding in the audit: two independently correct
decisions that are incompatible. A CSP that excludes `'unsafe-inline'` is right.
Applying the theme before paint is right. Nobody checked that they can coexist.

**Fix options, in order of preference:**

1. Move the script to an external file (`public/theme-bootstrap.js`) and
   reference it — the approach the patch takes.
2. Compute a SHA-256 hash of the inline script and add it to `script-src`.
   Works, but the hash changes on every byte edit and breaks silently as a
   theme flash, not an error.
3. `'unsafe-inline'` — **do not**. It defeats the directive entirely.

---

### T-04 — Vulnerable production dependencies
**Critical · PRESENT BUT NOT IN FORCE**

35 advisories across the full tree; **20 in the production tree** (1 critical,
9 high, 9 moderate, 1 low).

The critical one is `tar`, reached through `@vercel/node` — which is declared as
a **production dependency** while being used only for a type-only import. Moving
it to `devDependencies` removes it from the deployed tree.

Also high: `react-router-dom` `7.14.1` (8 high advisories; `7.18.4` resolves
them), `ws`, `undici`, `brace-expansion`, `path-to-regexp`.

The patch takes the production tree to **0 advisories**. It is **not applied**.
`package.json` in `main` still declares `@vercel/node` under `dependencies`.

**The systemic fix is the CI audit gate**, not the one-off bumps:
`npm audit --omit=dev --audit-level=high` must fail the build. Without a gate,
the tree re-rots within a quarter.

---

### T-05 — Broken authorisation on privileged columns
**High · PARTIAL**

Three separate failures were found:

1. **No `WITH CHECK` on the `users` `UPDATE` policy.** `USING` decides which rows
   you may touch; `WITH CHECK` decides which rows you may leave behind. Without
   it, a user can target their own row and rewrite `user_id` to point elsewhere.
2. **`lock_privileged_user_columns` trigger is inert** — it exists and does not
   fire. `role` and `subscription_tier` are therefore writable through a
   row-level policy, which is privilege escalation to admin.
3. **A column-level `REVOKE` is a no-op** — revoking a privilege that was never
   granted succeeds and changes nothing, so it read as protection in review while
   providing none.

**Verify with SQL, not by reading code:**

```sql
-- Are the triggers actually enabled? 'O' means enabled, 'D' means DISABLED.
select tgname, tgenabled from pg_trigger where tgrelid = 'public.users'::regclass;

-- Is the UPDATE policy missing its WITH CHECK?
select policyname, cmd, qual, with_check from pg_policies where tablename = 'users';

-- What column privileges actually exist?
select grantee, privilege_type, column_name
from information_schema.column_privileges where table_name = 'users';
```

---

### T-06 — Public storage bucket with deterministic paths
**High · PRESENT BUT NOT IN FORCE**

A **public** storage bucket holds user photos at **deterministic, guessable**
paths. A public bucket means anyone with the URL reads the object without
authentication or RLS.

**Compounding factor:** Supabase project URLs are not secret, so the bucket and
paths are effectively enumerable.

**Fix:** private bucket, signed URLs with short TTL, paths that include the
owner's UUID so a policy can scope reads, and RLS on `storage.objects`.

**Why not "randomise the path"?** Obscurity is not authorisation. A path can leak
once (a shared screenshot, a referrer header, a log line) and then it is public
forever. Make the bucket private and let a policy decide.

---

### T-07 — Rate limiting fails open
**High · PARTIAL**

The production limiter was **fail-open on RPC error**: if the database call threw,
the request was allowed. A database blip therefore removed the limit entirely,
turning a transient error into an unlimited-use window — precisely when traffic is
most likely to be abusive.

**Fail-open is always the wrong default for a cost-bearing endpoint.** For an AI
route, denying is cheap and allowing is expensive. The reverse of the usual
availability intuition applies.

Also found: no `trust proxy` on the Express path, so `req.ip` was the proxy's
address and **every user shared one bucket** — a single user could exhaust the
allowance for everyone.

**Verify:** `select proname from pg_proc where proname = 'record_and_count_rate_limit';`
and confirm the `HARD_CAP` short-circuit from `20240101000600` is present.

---

### T-08 — Ghost accounts after deletion
**High · PRESENT BUT NOT IN FORCE**

`public.users` and `auth.users` were unrelated tables until migration
`20240101000700`. Deleting from `public.users` left the auth row intact: the
email stayed taken, sign-in still succeeded, and the profile no longer existed.

**Why this is a privacy defect, not a cosmetic one.** A user deletes their
account, sees a success message, and their authentication record survives. That
is a false statement to the user about their own data, and a GDPR/DPA-relevant
one.

**Both deletion paths must drive deletion through the auth admin API** so the FK
cascade fires. The correct cascade order also matters: children before parents.

---

### T-09 — Prompt injection
**Medium · PARTIAL (by design)**

Users control the text sent to the model. Injection via a scenario description is
inherent to the feature.

**Scope it correctly.** Prompt injection that changes what the model *says* is a
product-quality issue — bad advice, an off-brand reply. It is not a security
vulnerability. Prompt injection is a security problem only when it reaches
something that acts: tool calls, database writes, outbound requests.

**Current exposure is bounded** because model output is not executed, not used to
build SQL, and not used to make authorisation decisions. Keep it that way: the
moment a model response drives a tool call or a query, injection becomes RCE-adjacent.

**Defences in place:** output is rendered through `react-markdown` and
`src/utils/sanitizeHtml.ts`; `dangerouslySetInnerHTML` appears nowhere; no
`eval` / `new Function`.

---

### T-10 — XSS escalating to account takeover
**Medium · NOT IMPLEMENTED**

Session tokens live in `localStorage`, so any XSS yields full account access for
the token's lifetime, with no `HttpOnly` boundary.

**Mitigating context:** no `dangerouslySetInnerHTML`, no `eval`, sanitised
markdown, and a CSP without `'unsafe-inline'` in `script-src`. The attack surface
is narrow — but it narrows a window, it does not remove it, and a single
`dangerouslySetInnerHTML` added later reopens it fully.

**Accepted risk, not a fix.** Moving to `HttpOnly` cookies changes the auth
provider, the fetch wrapper, and the server-side JWT validator, and reopens CSRF
as a live concern. Recorded in `SECURITY.md` so it is not re-reported as new.

---

### T-11 — Third-party data in `dossiers`
**Medium · NOT IMPLEMENTED (a design gap, not a bug)**

`dossiers` holds notes about people who are not users and never consented: names,
a relationship phase, free-text notes.

**Why this is the highest-liability table.** Every other table holds data a user
gave about themselves, which they can consent to or delete. `dossiers` holds data
a user entered about someone else. That person has no account, no visibility, and
no deletion path.

**No technical control fixes this.** It needs a written retention stance, a
statement in the privacy policy, and a decision about what happens to a dossier
when the owning account is deleted. Recorded as an open documentation gap in
[`../README.md`](../README.md).

---

### T-12 — Unbounded request inputs
**Medium · PARTIAL**

Payload size limits must match across every mount. If the Express path accepts
10MB and the serverless path accepts 4.5MB, the effective limit is the smaller
one, and a request that succeeds locally fails in production.

**Current:** `express.json({ limit: '10mb' })`. Supabase's own default body
limits are lower, so an oversized payload can pass validation and fail at the
database with an opaque error.

**Also missing:** explicit length caps on AI prompt fields. Without a cap, a user
can submit a megabyte of text and burn the model's context window on one request
— a cheap denial-of-wallet against the AI budget.

---

### T-13 — Info disclosure on public endpoints
**Low · PARTIAL**

Public endpoints (`/api/health`, `/api/ai/test-key`, `/api/security/log`) return
information about system state. `/api/ai/test-key` reports whether a key is
*configured* — it must **never** echo the key, a prefix of it, or its length.

`/api/security/log` is public and rate-limited separately. It must accept only
bounded, non-sensitive event data: a public logging endpoint that stores
arbitrary attacker-controlled strings is a free storage-abuse surface.

**Verify:** `curl -s https://<domain>/api/ai/test-key` and confirm the response
contains a boolean, not a string derived from the key.

---

### T-14 — Denial of wallet via AI quota
**Medium · PARTIAL**

Every AI call costs money. A bypassable limit is a billable resource an attacker
can drain.

**Current controls:** tier gating, DB-backed rate limiting (production),
client-disconnect cancellation on the streaming route, and a budget guard around
the upstream call.

**Weaknesses:** the limiter was fail-open (T-07); the dev limiter is in-process
and bypassable; the account-delete window was documented as 5 minutes while the
Express path enforced 60 seconds — a *looser* limit than documented is the one
that actually applies, and a documented limit nobody enforces is worse than no
documentation.

---

## 4. Control inventory

| Control | Mechanism | Status |
| --- | --- | --- |
| Server-derived identity | `getAuthenticatedUser` — body `userId` never trusted | ✅ IN FORCE |
| JWT verification | Supabase verification of the bearer token | ✅ IN FORCE |
| CSRF gate | Requires `Content-Type: application/json` or `X-Requested-With`; **fail-closed** | ✅ IN FORCE |
| CORS allow-list | Explicit origins + `Vary: Origin`; never `*` with credentials | ✅ IN FORCE |
| CSP | `api/lib/http.ts` — excludes `'unsafe-inline'` in `script-src` | ⚠ in force but **blocks the app's own script** (T-03) |
| Security headers on HTML | `vercel.json` `headers` | ❌ ABSENT (T-02) |
| Upload validation | Magic-byte sniffing, size cap, JWT-derived path | ✅ IN FORCE |
| Payload validation | Shape + length clamping before insert | ✅ IN FORCE |
| Rate limiting (prod) | Atomic `record_and_count_rate_limit` RPC | ⚠ present, was fail-open (T-07) |
| Rate limiting (dev) | In-process `Map` | ⚠ per-instance, resettable |
| RLS | `auth.uid() = user_id` on public tables | ⚠ gaps (T-05) |
| Privileged column lock | Trigger on `users` | ❌ INERT (T-05) |
| Storage authorisation | Bucket policy | ❌ publicly readable (T-06) |
| Account deletion integrity | Auth-admin-driven cascade | ⚠ patch not applied (T-08) |
| Build-time secret guard | `vite.config.ts` aborts on forbidden `VITE_` names / secret shapes | ✅ IN FORCE |
| Output escaping | `react-markdown` + `sanitizeHtml.ts`; no `dangerouslySetInnerHTML` | ✅ IN FORCE |
| Secret scanning | gitleaks config + pre-commit | ⚠ produced, not wired (T-01) |
| Dependency audit gate | `npm audit --omit=dev --audit-level=high` in CI | ❌ ABSENT (T-04) |
| CI pipeline | `.github/workflows/` | ❌ ABSENT |
| Session storage | `HttpOnly` cookie | ❌ NOT IMPLEMENTED (T-10) |

**Three of nine critical/high rated controls are marked ✅.** That is the honest
number, and it is the reason the top of `CHANGELOG.md` reads the way it does.

---

## 5. Prioritised remediation

### Immediate — 24 hours

1. **Rotate every credential in the 2026-04-17 → 2026-05-20 window.** Nothing
   else on this list matters while step 1 is undone.
2. Add the `vercel.json` `headers` block (T-02).
3. Delete the public storage policy; make the bucket private (T-06).
4. `npm audit fix`, move `@vercel/node` to devDependencies (T-04).
5. Install gitleaks as a pre-commit hook (T-01).

### Short term — 1–2 weeks

6. Purge git history; open the GitHub support ticket; notify collaborators (T-01).
7. Move the inline theme script to an external file (T-03).
8. Fix the `users` `UPDATE` policy with `WITH CHECK`; make the column lock
   actually fire; verify with SQL (T-05).
9. Make the rate limiter fail-**closed**; add `trust proxy` (T-07).
10. Apply the ghost-account deletion fix (T-08).
11. Add length caps to AI inputs; align body limits across mounts (T-12).
12. Add the CI audit gate (T-04).

### Medium term — 1 month

13. Move session storage to `HttpOnly` cookies (T-10).
14. Add COOP/CORP/Permissions-Policy; drop `X-XSS-Protection` (deprecated).
15. Write the `dossiers` retention stance into the privacy policy (T-11).
16. Add automated RLS regression tests (pgTAP) so a policy edit cannot silently
    reopen T-05. The hardening patch's 15 assertions — 11 of which fail against
    the unpatched baseline — are the right shape.
17. Replace regex sanitisation with a real parser; add a CSP report-only rollout.

---

## 6. Verification commands

Run these against a real deployment rather than trusting any document,
**including this one**.

```bash
# Security headers actually served
curl -sI https://<domain>/ | grep -iE \
  'content-security-policy|strict-transport-security|x-frame-options|referrer-policy|permissions-policy'

# Does the CSP reference the inline script? Look for a 3rd <script> with no src
curl -s https://<domain>/ | grep -c '<script'

# Is the AI key echoed back? Expect a boolean, not a string derived from the key
curl -s https://<domain>/api/ai/test-key

# Production advisories only
npm audit --omit=dev

# Secret shapes in the working tree
grep -rnE '(sk-|sbp_|service_role|BEGIN [A-Z ]*PRIVATE KEY)' \
  --include='*.ts' --include='*.tsx' --include='*.json' . | grep -v node_modules
```

```sql
-- RLS enabled per table? Every public table should read 't' in rowsecurity.
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';

-- Policies, with WITH CHECK visible. A NULL with_check on an UPDATE/ALL policy is a hole.
select tablename, policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' order by tablename, policyname;

-- Public storage buckets
select id, name, public from storage.buckets;
```

---

**Last verified: 2026-09-26**
