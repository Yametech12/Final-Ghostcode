<<<<<<< ours
<!-- Title format: <type>: <short summary> (feat | fix | chore | docs | perf | refactor | test) -->

## Summary

<!-- What does this PR change and why? Keep it to 2-3 bullets. -->

-

## Linked issues

<!-- e.g. Closes #123, Relates to #45 -->

-

## Screenshots

<!-- Required for UI changes. Before/after, desktop + mobile. Drag images here. -->

| Before | After |
| --- | --- |
|  |  |

## Test notes

- [ ] `npm run lint:all` passes locally
- [ ] `npm test` passes locally
- [ ] `npm run build` passes locally

Covered cases:

-

## Migration notes

- [ ] No Supabase migration needed

<!-- If there IS a migration: list the file, the apply order, and the rollback. -->

- Migration file:
- Apply order:
- Rollback plan:
=======
# Pull Request

Read [`CONTRIBUTING.md`](../CONTRIBUTING.md) before opening this. PRs that fail
CI, reformat unrelated files, or add `any` where `unknown` was sufficient will be
closed.

## What changed

<!-- One paragraph. What is different after this PR merges? -->

## Why

<!-- Link the issue. If there is no issue and this is more than a bug fix,
     say so and explain the reasoning. -->

Closes #

## Type

- [ ] `feat` — new user-visible capability
- [ ] `fix` — bug fix
- [ ] `perf` — performance
- [ ] `refactor` — behaviour-preserving restructuring
- [ ] `docs` — documentation only
- [ ] `chore` — tooling / dependencies / housekeeping
- [ ] `security` — security fix (**say so, so it is reviewed with the right urgency**)

## How this was verified

Paste the **actual output**, not a summary. "Tests pass" without the output is not
verification.

```bash
npm run lint:all && npm test && npm run build
```

```
# paste the real output here
```

## Risk

<!--
What could this break? What is the blast radius? If you changed a database
migration, an API contract, an environment variable, or anything in api/, say so
explicitly.
-->

## Checklist

### General

- [ ] The full gate passes locally: `npm run lint:all && npm test && npm run build`
- [ ] One logical change. No drive-by reformatting of untouched files.
- [ ] No `.env` file, real secret, or build artifact (`dist/`, `tsconfig.tsbuildinfo`)
      is included
- [ ] The PR title is written as a Conventional Commit subject — it becomes the
      squash-merge commit
- [ ] I read the diff myself before requesting review

### If this is a bug fix

- [ ] A regression test is included that **fails before the fix** and passes after
- [ ] I have stated the root cause above, not just the symptom

### If this touches `api/`

- [ ] The route is registered in **both** `api/_index.ts` and `api/server.ts`
- [ ] The caller's identity is derived server-side via `getAuthenticatedUser` —
      no `userId` is read from a body or query string
- [ ] Every untrusted field is validated and length-clamped before it reaches Supabase
- [ ] A test covers: unauthenticated, wrong role, malformed body, and the happy path

### If this touches `supabase/migrations/`

- [ ] It is a **new** timestamped file; no already-applied migration was edited
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is present for any new table
- [ ] Policies cover `SELECT`, `INSERT`, `UPDATE`, `DELETE` as applicable
- [ ] Every non-read-only policy has a **`WITH CHECK`** clause, not only `USING`
- [ ] No policy grants write access to a privileged column (`role`,
      `subscription_tier`, `subscription_expires_at`)
- [ ] Indexes exist for columns used in policy predicates or hot query filters
- [ ] A destructive change has a **tested** inverse migration

### If this touches styling or UI

- [ ] No raw colour literal (`#hex`, `rgb()`, `hsl()`) in a component — tokens only
- [ ] Contrast checked in **both** themes; body text ≥ 4.5:1
- [ ] Icon-only controls have an `aria-label`
- [ ] Form controls have a linked `<label htmlFor>` / `id` pair
- [ ] State is not signalled by colour alone
- [ ] Full-height mobile layouts use `100dvh` with a `100vh` fallback

### If this changes an API contract, env var, or DB column

- [ ] `BREAKING CHANGE:` footer is present in the commit message
- [ ] `README.md` and `docs/architecture/README.md` are updated
- [ ] `CHANGELOG.md` has an entry

## Screenshots

<!--
For UI changes only. Before/after, in BOTH themes. Use seed data — never include
real user data, a real email address, or a populated API key.
-->
>>>>>>> theirs
