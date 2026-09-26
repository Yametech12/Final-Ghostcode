# Secrets Rotation & History Purge Runbook

**Last verified: 2026-09-26**

Use this when a credential has been — or may have been — exposed. Also use it on
schedule: the project's own `.env.example` recommends rotating the Supabase
service-role key and the Regolo key **every 30–90 days**.

> **Read this before step 1.** Deleting a `.env` file does **not** revoke
> anything. Git history is permanent; anyone who cloned, forked, mirrored, or
> scraped the repository retains the values indefinitely. The only action that
> ends an exposure is **rotating the credential**. Everything below is ordered
> that way on purpose — rotation first, history rewrite second, and the rewrite is
> the *cleanup*, not the *fix*.

---

## 0. What was exposed

From the analysis of this repository at commit
`37c2505f487fd1d43ab73eb7ec3d909767e7546f`, the commit window containing
committed `.env` material is **2026-04-17 → 2026-05-20**. A gitleaks scan of the
full history found **70 leaks** using custom rules for this project's key shapes.

| Variable | Occurrences in history | Severity | Blast radius |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | 13 | **Critical** | Billable inference theft |
| `VITE_OPENROUTER_API_KEY` | 5 | **Critical** | Same key **baked into the client bundle** — public |
| `REGOLO_API_KEY` | 3 | **Critical** | Billable inference theft |
| `VITE_REGOLO_API_KEY` | 4 | **Critical** | Same key **in the client bundle** — public |
| `SUPABASE_SERVICE_ROLE_KEY` | present | **Critical** | **Bypasses RLS entirely** — full read/write/delete over every table |
| `GMAIL_APP_PASSWORD` | present | **Critical** | Account mail sent as the project |
| `VITE_SUPABASE_ANON_KEY` | present | Low | Public by design; RLS is the control |
| `SENTRY_DSN`, `STRIPE_*` | if present | Medium / High | Stripe secret key is full account API access |

**The `VITE_`-prefixed entries are the worst of these.** A `VITE_*` variable is
inlined into the JavaScript bundle at build time, so the value was not merely in
the repository — it was served to every visitor of the deployed site. If the site
was ever live with those values, treat the keys as public and assume they were
harvested.

**If you are reading this because you suspect `SUPABASE_SERVICE_ROLE_KEY` leaked:**
assume every row in every table has been readable and writable by whoever holds
it. A row-level policy does not constrain the service role. Rotation is urgent,
and after rotating you should review for unexpected data changes.

---

## 1. Rotation — do this first

For each exposed credential. The order matters: **revoke before you deploy the
new value**, so there is no window where both are valid.

### 1.1 Regolo AI

```bash
# 1. Sign in → API keys → revoke the exposed key
#    https://regolo.ai
# 2. Create a new key. Copy it once — do not store it in a file in the repo.
# 3. Deploy the new value to the environment (Vercel dashboard for prod,
#    .env locally). NEVER name it VITE_REGOLO_API_KEY.
# 4. Verify the new key works, THEN confirm the old one is dead:
curl -s https://api.regolo.ai/v1/models \
  -H "Authorization: Bearer $OLD_REGOLO_KEY" -o /dev/null -w '%{http_code}\n'
# Expect 401. A 200 means the revoke did not take effect — retry step 1.
```

### 1.2 OpenRouter

Same shape: revoke at <https://openrouter.ai/keys>, issue a replacement, deploy as
`OPENROUTER_API_KEY` (**no `VITE_` prefix**), then confirm the old key returns 401.

### 1.3 Supabase

Three distinct secrets — rotate them independently, and know which is which.

| Secret | Public? | Rotation path |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Not a secret. Changes only if you migrate projects. |
| `VITE_SUPABASE_ANON_KEY` | Yes, by design | Settings → API → **Rotate** the anon key. RLS is what protects data, so this is low urgency — but rotating is cheap, and after a leak event, rotate. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Absolutely not** | Settings → API → **Rotate** the service role key. **This is the urgent one.** |

```bash
# After rotating the service role key, verify the old one is rejected:
curl -s "$SUPABASE_URL/rest/v1/users?select=id&limit=1" \
  -H "apikey: $OLD_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $OLD_SERVICE_ROLE_KEY" -o /dev/null -w '%{http_code}\n'
# Expect 401.
```

**Then review the data.** With a service-role key, an attacker can read and write
every table and every storage object. After rotating:

```sql
-- Rows you did not create
select id, email, role, created_at from public.users order by created_at desc limit 50;
-- Unexpected privilege changes
select id, email, role, subscription_tier from public.users where role = 'admin';
-- Anything in the last 60 days you cannot account for
select count(*) from public.oracle_analyses where timestamp > now() - interval '60 days';
```

### 1.4 Gmail app password

1. <https://myaccount.google.com/apppasswords> → revoke the exposed password.
2. Issue a replacement.
3. Deploy as `GMAIL_APP_PASSWORD`.
4. **Check the account's sent mail** for messages you did not send — an app
   password grants send-as permission, and a phishing run from your address looks
   like you.
5. Review account filters and forwarding rules; both are persistence mechanisms
   that survive a password change.

### 1.5 Stripe (if keys were ever present)

1. Dashboard → Developers → API keys → **roll** the secret key.
2. Dashboard → Webhooks → roll the signing secret.
3. Deploy both. Re-verify the webhook endpoint signature after the roll.

### 1.6 Sentry (if a server DSN was ever committed)

Rotate the DSN under project settings. A DSN alone permits event submission, not
data read — downgrade to Medium, but rotate anyway.

### 1.7 Google Cloud (only if a key file was committed)

Service-account JSON is a full credential and must be treated as Critical even
though the GCS variables are currently unused by the code. Revoke the key on the
service account, and check IAM for bindings you did not add.

---

## 2. Verify the rotation actually took

**A rotation you did not verify is a rotation you do not have.** For each old
credential, confirm it is rejected:

```bash
# Regolo
curl -s https://api.regolo.ai/v1/models -H "Authorization: Bearer $OLD" -o /dev/null -w '%{http_code}\n'
# OpenRouter
curl -s https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OLD" -o /dev/null -w '%{http_code}\n'
# Supabase service role
curl -s "$SUPABASE_URL/rest/v1/users?select=id&limit=1" -H "apikey: $OLD" -o /dev/null -w '%{http_code}\n'
```

All three must return `401`. A `200` means the credential is live and step 1 was
not completed. Do not proceed to §3 with a live exposed credential — a history
rewrite while the key still works produces a clean-looking repository and an open
door.

Then confirm the **new** values work end-to-end:

```bash
npm run diagnose
curl -s https://<your-domain>/api/health
curl -s https://<your-domain>/api/ai/test-key   # expect a boolean, not the key
```

---

## 3. Purge git history

Only after §2 passes.

### 3.1 Install the tool

```bash
pip install git-filter-repo
# or: brew install git-filter-repo
git filter-repo --version
```

### 3.2 Dry run first — always

The repository includes `scripts/purge-secrets-history.sh`, which **defaults to
dry-run**. Run it and read the output before anything is rewritten:

```bash
bash scripts/purge-secrets-history.sh
```

`git filter-repo` rewrites every commit hash. That means every open pull request
breaks, every collaborator's local clone diverges, and every commit link in any
external doc, issue, or chat message stops resolving. This is not reversible
without a backup.

### 3.3 Back up

```bash
cd ..
git clone --mirror Final-Ghostcode Final-Ghostcode-backup.git
tar czf Final-Ghostcode-backup-$(date +%F).tar.gz Final-Ghostcode-backup.git
# Store this somewhere OUTSIDE the repository and outside the drive you sync.
```

### 3.4 Remove the files from history

```bash
cd Final-Ghostcode

git filter-repo --invert-paths \
  --path .env \
  --path .env.local \
  --path .env.production \
  --path-glob '.env.*' \
  --path dist \
  --path tsconfig.tsbuildinfo

# Then scrub the values that remain inside other files' contents:
git filter-repo --replace-text ../redactions.txt
```

`redactions.txt` uses `literal:` lines for exact strings — do not paste real
secrets into a file that lives inside the repository:

```
literal:REGOLO_API_KEY=sk-...
literal:OPENROUTER_API_KEY=sk-or-...
literal:SUPABASE_SERVICE_ROLE_KEY=eyJ...
literal:GMAIL_APP_PASSWORD=...
```

### 3.5 Force-push and tell everyone

```bash
git remote add origin https://github.com/Yametech12/Final-Ghostcode.git
git push --force --all
git push --force --tags
```

Then, **every collaborator must re-clone.** Their existing local copy still
contains the secrets in `.git`, and their next `git push` restores them:

```bash
# What each collaborator runs:
git revert / stash anything uncommitted
rm -rf <their-clone>
git clone https://github.com/Yametech12/Final-Ghostcode.git
# A plain `git pull` is NOT sufficient — it leaves the old objects in place.
```

### 3.6 Ask GitHub to clear cached objects

**A force-push does not clear GitHub's cache.** Old commits remain reachable by
SHA for a period. Open a support ticket at
<https://support.github.com/contact> requesting removal of cached views for the
affected commits. Include the SHAs.

Until that completes, the old blobs are still retrievable by anyone who kept a
link. This is why §1 comes first.

---

## 4. Prevent the next one

### 4.1 In the repository (already added by this change set)

| File | Purpose |
| --- | --- |
| `.gitignore` | Blocks `.env` and all `.env.*` variants, plus build outputs |
| `vite.config.ts` | **Build-time guard** — aborts the build if a forbidden `VITE_` name is present, or if a secret-shaped string appears in the emitted bundle |
| `.gitleaks.toml` | Custom rules for this project's key shapes (Regolo, OpenRouter, Gmail, Supabase) |
| `.pre-commit-config.yaml` | Runs gitleaks before the commit is created |
| `scripts/block-env-and-build-artifacts.sh` | Pre-commit hook blocking `.env` and build artifacts |
| `.github/workflows/secret-scan.yml` | Scans on push and pull request |
| `SECRETS_ROTATION_CHECKLIST.md` | The checklist form of this document |

### 4.2 On GitHub (owner action — cannot be done from the repository)

1. **Settings → Code security → Secret Scanning: enable.**
2. **Settings → Code security → Push Protection: enable.** This is the one that
   actually prevents the next leak rather than reporting it after the fact.
3. **Settings → Branches → add a ruleset** requiring reviews and passing CI
   before merge to `main`.
4. Enable Dependabot alerts and security updates.

### 4.3 In the deployment platform

- Set every secret in the Vercel project settings, never in a committed file.
- Use **separate** credentials for local development, preview, and production. A
  leaked preview key should be worthless against production.
- Rotate on a 30–90 day schedule regardless of suspicion, and record the date so
  the next rotation is not forgotten.

---

## 5. The recurring failure this runbook exists to prevent

The build-time guard in `vite.config.ts` is good, and it is a **backstop, not the
rule**. It catches a forbidden name at build time; it does not stop someone
typing a secret into a source file, and it does not run during a commit.

The rule to teach every contributor:

> **A server secret must never be `VITE_`-prefixed.** Vite inlines every `VITE_*`
> variable into the client bundle at build time. Whatever you prefix is public,
> permanently, in every user's browser.

And the habit that catches the rest:

```bash
gitleaks detect --source . --verbose
```

Run it before you push. If it finds something, **rotate the credential** — do not
just delete the line. By the time a scanner sees a secret, it has been in the
repository for at least one commit, and the only question that matters is whether
anyone else already has it.

---

**Last verified: 2026-09-26**
