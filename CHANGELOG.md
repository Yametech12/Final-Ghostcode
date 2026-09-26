# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project intends to adhere to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) once the first
release is tagged.

**Last verified: 2026-09-26**

---

## A note on this file's history

This is the **first** `CHANGELOG.md` in the repository. Before it existed, the
project had no structured change record, and the git history begins at
`c892075 feat(legal): add Terms of Service and Privacy Policy pages` before the
repository was published — **earlier history was lost and cannot be
reconstructed here.** Nothing below claims to cover it.

Everything recorded under *Unreleased* comes from one of two places, and each
entry says which:

- **Merged** — the change is present in `main` at
  `37c2505f487fd1d43ab73eb7ec3d909767e7546f` (2026-09-12) and was verified
  against that commit.
- **Proposed (patch produced, not applied)** — a patch file exists and was
  verified against the code, but it is **not merged into `main`**. Do not expect
  the behaviour described to be live.

If you are reading this in a checkout that is not the repository owner's, check
whether the proposed patches were ever applied before relying on them.

---

## [Unreleased]

### Added

- **`LICENSE`** — MIT. Copyright (c) 2026 Yametech12. *(Merged.)*
- **`CONTRIBUTING.md`** — development setup, coding standards, Conventional
  Commits convention, fork-and-PR workflow, database and API change checklists.
  *(Merged.)*
- **`SECURITY.md`** — supported versions, private reporting process, response
  timeline, scope, and a list of known accepted risks. *(Merged.)*
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant v2.1. *(Merged.)*
- **`CHANGELOG.md`** — this file. *(Merged.)*
- **`.github/` templates** — pull-request template, bug-report and
  feature-request issue templates, and issue-template configuration.
  *(Merged.)*
- **`docs/` tree** — architecture overview with diagrams, security threat model,
  secrets-rotation runbook, the intended Stripe flow, and deployment and
  monitoring runbooks, with an index at `docs/README.md`. *(Merged.)*
- **`docs/archive/2026-q3-todos.md`** — `TODO.md` moved to the archive with a
  completion stamp. Every item in it had already been fixed; leaving a stale
  to-do list in the repository root was actively misleading. *(Merged.)*
- **`package.json` metadata** — `description`, `license`, `engines`
  (`node >= 20.0.0`), and `author`. *(Merged.)*

### Changed

- **`README.md` rewritten.** The previous README scored 24/50 against a
  documentation rubric and contained at least seven verifiable errors (wrong
  canonical schema file, three SQL files where there are nine, "one util test"
  where there are five test files, a nonexistent `Layout.tsx` path, and a
  licence statement that contradicted itself). Every claim in the new README was
  re-derived from the source at the commit above; the corrections are listed
  explicitly in §13 of that file rather than being silently edited away.
  *(Merged.)*
- **`STRUCTURE.md` rewritten** against the real tree. The previous version
  described files and directories that do not exist: `api/_server.ts`,
  `api/index.ts`, an `api/ai/` directory, and `scripts/debug-script.js`.
  *(Merged.)*
- **`DEEP_ANALYSIS.md` rewritten.** It claimed 23 routes (there are 27 page
  components), named Workbox as the PWA layer (the service worker is
  hand-written, 112 lines, with no Workbox dependency), and listed a
  Llama-3.1-8B fallback model that commit `f358810` had already removed as
  invalid. *(Merged.)*

### Security

Findings below came from a ten-agent audit of the repository. They are
**outstanding** — recorded so they are not forgotten, not to imply they are
closed.

- Live API keys and a mail app password were committed in `.env` files in the
  repository history (commit window 2026-04-17 → 2026-05-20 per the analysis of
  the patch produced for this item). **Rotating every exposed credential is an
  owner action that no patch can perform**, and until it happens the exposure
  stands regardless of what is merged. *(Proposed — patch produced, not applied.)*
- Production HTML carried no security headers (no CSP, HSTS, or
  `X-Frame-Options`). A `vercel.json` `headers` block was produced.
  *(Proposed — patch produced, not applied. `vercel.json` in `main` still has no
  `headers` block.)*
- The CSP excluded `'unsafe-inline'` from `script-src` while `index.html`
  contained an inline theme-bootstrap script, meaning the script is **blocked in
  production**. The fix moves the script to an external file. *(Proposed — patch
  produced, not applied. The inline script is still present in `main`.)*
- 35 dependency advisories, of which 20 were in the production tree (3 critical,
  14 high, 16 moderate, 2 low across the full tree). A patched
  `package.json` / `package-lock.json` moved `@vercel/node` to devDependencies
  (it was used for a type-only import) and bumped `react-router-dom`, `ws`,
  `concurrently`, `path-to-regexp`, `postcss`, and `brace-expansion`, taking the
  production tree to **0 vulnerabilities**. *(Proposed — patch produced, not
  applied. `main` still declares `@vercel/node` as a production dependency.)*
- RLS gaps: a missing `WITH CHECK` on the `users` `UPDATE` policy, a column
  `REVOKE` that was a no-op, an inert column-lock trigger, and a **public**
  storage bucket allowing read of user photos at deterministic paths. A
  hardening migration set plus pgTAP coverage (15 assertions, 11 of which fail
  against the unpatched baseline) was produced. *(Proposed — patch produced, not
  applied.)*
- The production rate limiter was fail-open on RPC errors, meaning a database
  error removed the limit entirely instead of denying. *(Proposed — patch
  produced, not applied.)*
- Account self-deletion could leave a "ghost" auth row: the public profile row
  was removed while the auth user survived, so the email stayed taken and
  sign-in still succeeded. *(Proposed — patch produced, not applied.)*
- `message?.trim()` threw a `500` on a non-string request body — reachable from
  an unauthenticated-shaped request. *(Proposed — patch produced, not applied.)*
- Public storage bucket with deterministic object paths leaked user photos.
  *(Proposed — patch produced, not applied.)*

### Fixed

- **Documentation drift across five documents.** An audit found 27 discrete
  errors: 13 in `STRUCTURE.md`, 8 in `DEEP_ANALYSIS.md`, 5 in
  `FIXES_APPLIED.md`, 7 stale items in `TODO.md`, and 7 in `README.md`.
  `STRUCTURE.md` and `DEEP_ANALYSIS.md` were rewritten, `TODO.md` was archived,
  and `README.md` was rewritten with its corrections listed explicitly.
  *(Merged.)*
- **Cross-cutting documentation defects.** Multiple project names for one
  product (`react-example` in `package.json`, `Remix: Epimetheus` in
  `metadata.json`, `EPIMETHEUS` in `index.html`); no licence field; no dates on
  any document; and a README with no screenshots. All documents now carry a
  `Last verified` date. The naming inconsistency is **recorded but not resolved**
  — renaming `package.json` `"name"` is safe, but it was not done here because
  the intended product name is the owner's decision. *(Partially merged.)*

### Known issues (recorded, not fixed)

These are real defects confirmed against the code. None has a patch yet.

- **No CI pipeline.** There is no `.github/workflows/` directory. Nothing runs
  the type-check, the tests, or the build automatically, so a broken commit can
  reach `main`. A workflow is included in this change set as the first step;
  enabling branch protection is an owner action in the GitHub UI.
- **Test coverage is thin and tests are not type-checked.** 5 test files cover
  `api/lib/handlers.ts`, `api/lib/auth.ts`, and three utilities. There are zero
  component and zero hook tests for 27 pages and 50+ components. `tsconfig.json`
  excludes test files from `tsc --noEmit`, so a test file can hold a type error
  and still pass.
- **Oversized modules.** `api/lib/handlers.ts` is 1392 lines and mixes every
  route domain. `src/pages/CalibrationPage.tsx` is 1933 lines with 21 `useState`
  and 4 `useEffect` calls. Both are hard to review and hard to test.
- **Remaining `any` usage.** Present in the API and UI trees, which disables
  downstream type checking. Not quantifiable from this change set; count it with
  `grep -rn ': any' src api` rather than trusting a figure.
- **Dead and duplicate SQL files.** `supabase-schema-v2.sql`,
  `scripts/rls-audit.sql`, and `scripts/create-rate-limits-table.sql` duplicate
  schema that `supabase/migrations/` already owns. They were kept for one
  release cycle; that cycle is over.
- **`tsconfig.tsbuildinfo` is committed** (148,946 bytes) despite `*.tsbuildinfo`
  being in `.gitignore` — it was tracked before the ignore rule existed, and
  `.gitignore` does not untrack an already-tracked file.
- **`package.json` `"name"` is `react-example`**, a scaffold default that
  survives in the published package metadata.
- **`public/favicon.svg` does not exist** while `index.html` references it, so
  every page load requests a 404.
- **`scripts/` holds deprecated SQL** that a contributor may reasonably mistake
  for current schema.
- **`uiStore` and other persisted state read `localStorage` through
  `safeParseJSON`**, which is the right pattern, but any *new* direct
  `JSON.parse` on stored data reintroduces a crash-on-corrupt-data path.
- **The dev server's rate limiter is in-process** and therefore per-instance and
  resettable. Fine locally; must never be exposed publicly.
- **Session tokens live in `localStorage`**, so any XSS escalates to full account
  takeover. Moving to `HttpOnly` cookies is a cross-cutting auth change.
- **Stripe is not live**, so no tier change can actually be paid for. Tiers are
  admin-set.

---

## Related work (audit reports)

A ten-agent audit of this repository produced separate reports. Their findings
are summarised in *Unreleased → Security* and *Known issues* above. **None of
those reports' patches are applied to `main`**, and the reports live outside this
repository.

| Agent | Scope | Outcome |
| --- | --- | --- |
| Tech Stack & Architecture | Stack, layout, purpose | Completed |
| Bug Detection & Error Analyzer | Build, lint, dependency audit | Completed — 35 advisories found |
| UI/UX Design Reviewer | 27 pages, contrast, a11y | Completed — light theme failed WCAG AA |
| Security Vulnerability Auditor | 28 findings | Completed — 3 critical, 7 high |
| Performance Optimization | Bundle, render-blocking, fonts | Completed — 1 blocking stylesheet, per-scroll `setState` |
| Code Quality & Best Practices | Complexity, duplication, naming | Completed — god modules, 0 component tests |
| Documentation Completeness | 10 markdown files, 2269 lines | Completed — 27 drifts, 7.1% doc ratio |
| Dependencies & Package | 1011 lock entries | Completed — 20 production advisories |
| Feature Enhancement & Modernization | Gaps vs. shippable product | Completed — no CI, no working billing |
| Master Improvement Coordinator | Aggregation | **Failed** — the tool errored repeatedly and was stopped |

Two further agents — a `handlers.ts` domain split and a TypeScript `any`
elimination pass — were started but **did not complete**, and produced no
verified deliverable. They are not listed as work in progress.

---

## Format reference

For contributors adding entries:

- **`Added`** for new features.
- **`Changed`** for changes to existing behaviour.
- **`Deprecated`** for features still present but slated for removal.
- **`Removed`** for features removed in this release.
- **`Fixed`** for bug fixes.
- **`Security`** for vulnerabilities, in the sense of inviting the reader to
  upgrade — and, in this project's case, to note what still needs rotating.

Write entries for the reader who has to decide whether to act, not for the
author who wants credit. An entry that says *"fixed a bug"* is not an entry.

---

**Last verified: 2026-09-26**
