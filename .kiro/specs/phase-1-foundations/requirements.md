# Requirements Document

## Introduction

Phase 1 of the Epimetheus improvement plan establishes a quality-and-safety floor for the existing webapp before any further feature work. It is explicitly a foundations pass: nothing in this phase changes runtime behaviour for end users. The phase delivers four work items that are individually shippable but logically related — focused tests on the validation/security boundary, resolution of high/critical `npm audit` findings, consolidation of the database schema into Supabase migrations, and a minimal GitHub Actions CI workflow.

The four items can ship in any order, but the recommended sequence is **tests → CI → migrations → audit**, because tests give CI something meaningful to gate on, CI then enforces the quality bar for every subsequent change, and migrations and the audit become safer to apply once the gate is in place.

**Out of scope for this phase** (called out explicitly so subsequent phases own them):
- Splitting `Layout.tsx` or `CalibrationPage.tsx`
- Replacing the no-op Supabase auth lock
- `ProfileCard` parallax memoization
- Virtualizing message lists with `react-window`
- Any UI/UX changes
- Reactions persistence
- Accessibility audit
- Tightening `any` usage in `api/**`
- Any change to the database schema (RLS policies, RPCs, columns, indexes) beyond moving the existing SQL into migration files

## Glossary

- **Test_Suite**: The Vitest test suite invoked by `npm run test`. Runs in `jsdom` environment with `@testing-library/react` available.
- **Validation_Module**: The set of source files containing input validation, sanitization, and request-shape enforcement: `src/utils/sanitizeHtml.ts`, `src/utils/validation.ts`, `api/lib/handlers.ts` (specifically the helpers `sanitizeOracleResult`, `handleSecurityLog`, `handleUploadProfilePhoto`, `handleCalibrationAnalyze`), and `api/lib/auth.ts` (specifically `getAuthenticatedUser` and `isValidUUID`).
- **Audit_Tool**: The `npm audit` command, run with the project's `package-lock.json`.
- **High_Severity_Finding**: A vulnerability reported by the Audit_Tool with severity `high` or `critical`.
- **Migration_Folder**: The directory `supabase/migrations/` recognized by the Supabase CLI as the canonical source of database schema. The CLI is already a dev dependency.
- **Legacy_Schema_Files**: The three existing SQL files that currently define the database schema, in their documented application order:
  1. `supabase-schema-v2.sql`
  2. `scripts/rls-audit.sql`
  3. `scripts/create-rate-limits-table.sql`
- **Reset_Command**: `supabase db reset`, which drops the local database, re-applies every file in the Migration_Folder in lexicographic order, and is the canonical "fresh database" entry point.
- **CI_Workflow**: A GitHub Actions workflow file at `.github/workflows/ci.yml` triggered on `push` and `pull_request` events targeting the `main` branch.
- **Quality_Gate_Commands**: The four npm scripts that must succeed for CI to pass, in this order: `npm ci`, `npm run lint`, `npm run lint:api`, `npm run test`.
- **Phase_1_Output**: The collection of artefacts produced by this phase: new test files under `src/**/*.test.ts(x)` and `api/**/*.test.ts`, the migration files under `supabase/migrations/`, the CI workflow file, and a short audit report committed to the spec output (`.kiro/specs/phase-1-foundations/`).

## Requirements

---

### Requirement 1: Focused tests on the validation/security boundary

**User Story:** As a maintainer, I want unit tests on the modules that enforce input validation and security boundaries, so that regressions like the recent `sanitizeAiResponse` trim bug fail in CI instead of in production.

#### Acceptance Criteria

1. THE Test_Suite SHALL contain a test file `src/utils/sanitizeHtml.test.ts` that exercises `escapeHtml`, `stripHtml`, `sanitizeAiResponse`, and `sanitizeUserInput`.
2. WHEN `sanitizeAiResponse` is called with a string that contains leading or trailing whitespace, THE Test_Suite SHALL assert that the leading and trailing whitespace is preserved (this is the regression that the trim bug introduced).
3. WHEN `sanitizeAiResponse` is called sequentially on the token sequence `["Hello", " world", "!"]` and the outputs are concatenated, THE Test_Suite SHALL assert that the result equals `"Hello world!"` (no token-gluing).
4. WHEN `sanitizeAiResponse`, `stripHtml`, or `escapeHtml` is called with input containing `<script>`, `<iframe>`, `javascript:`, or `on…=` attributes, THE Test_Suite SHALL assert that the dangerous tokens are removed or escaped.
5. THE Test_Suite SHALL contain a test file `src/utils/validation.test.ts` that covers `sanitizeInput`, `isValidEmail`, `validatePasswordSecurity`, and the `RateLimiter` class.
6. WHEN `sanitizeInput` is called with a string containing `<script>` tags, `javascript:` URIs, or inline event handlers, THE Test_Suite SHALL assert that the dangerous content is removed and that ordinary text is preserved (modulo HTML-entity encoding).
7. WHEN `isValidEmail` is called, THE Test_Suite SHALL assert at minimum: a typical valid email returns `true`; an empty string returns `false`; a string missing `@` returns `false`; a string missing a TLD returns `false`.
8. WHEN `validatePasswordSecurity` is called with `""`, a short password, a password missing one character class, a password containing a known weak pattern (e.g., `"password"`, `"123456"`), and a strong password, THE Test_Suite SHALL assert that `isValid` and `strength` reflect the documented rules.
9. WHEN a `RateLimiter` instance is exercised by recording attempts up to and beyond `maxAttempts` within `windowMs`, THE Test_Suite SHALL assert that `isLimited` flips from `false` to `true` at exactly the `maxAttempts`-th attempt and that `getRemainingAttempts` decrements monotonically.
10. WHILE the test for `RateLimiter` is running, THE Test_Suite SHALL use Vitest fake timers (`vi.useFakeTimers`) rather than real `setTimeout` so that window expiry is asserted deterministically without sleeping.
11. THE Test_Suite SHALL contain a test file `api/lib/handlers.test.ts` that covers, at minimum, the request-shape behaviour of `sanitizeOracleResult`, `handleSecurityLog`, `handleUploadProfilePhoto`, and `handleCalibrationAnalyze`.
12. WHEN `sanitizeOracleResult` is called with an unknown `primaryType`, a non-object value, or `null`, THE Test_Suite SHALL assert that the function returns `null`.
13. WHEN `sanitizeOracleResult` is called with a valid result whose string fields exceed the documented per-field limits and whose `tasks` array exceeds 20 items, THE Test_Suite SHALL assert that every string is clamped to its declared maximum length and the `tasks` array is truncated to 20 items.
14. WHEN `handleSecurityLog` is called with an `event` longer than 100 characters or a `details` payload whose JSON serialization exceeds 2000 characters, THE Test_Suite SHALL assert that the response status is `400`.
15. WHEN `handleUploadProfilePhoto` is called with a base64 payload whose declared MIME type does not match the buffer's magic bytes, THE Test_Suite SHALL assert that the response status is `400` and the response code is `INVALID_IMAGE_BYTES`.
16. WHEN `handleUploadProfilePhoto` is called with a buffer larger than `1024 * 1024` bytes, THE Test_Suite SHALL assert that the response status is `413` and the response code is `FILE_TOO_LARGE`.
17. WHEN `handleCalibrationAnalyze` receives an AI response whose `summary`, `archetypes` items, or `traits` items exceed the documented length caps, THE Test_Suite SHALL assert that each field is clamped to its declared maximum length.
18. THE Test_Suite SHALL contain a test file `api/lib/auth.test.ts` that covers `getAuthenticatedUser` and `isValidUUID`.
19. WHEN `getAuthenticatedUser` is called with a missing header, an empty string, a header without a `Bearer ` prefix, or a `Bearer ` prefix followed by only whitespace, THE Test_Suite SHALL assert that the function returns `null` without invoking the Supabase client.
20. WHEN `getAuthenticatedUser` is called with a syntactically valid `Bearer <token>` header and a Supabase client double whose `auth.getUser` resolves to a user, THE Test_Suite SHALL assert that the function returns that user.
21. WHEN `isValidUUID` is called with a v4 UUID, an upper-case v4 UUID, a v1/v2/v3/v5 UUID, an empty string, `null`, `undefined`, and a non-UUID string, THE Test_Suite SHALL assert that the function returns `true` only for the v1–v5 cases (matching the implementation's `[1-5]` version-nibble regex).
22. THE Phase_1_Output SHALL contain between 10 and 25 newly added test cases across the files listed in criteria 1, 5, 11, and 18 (the target is meaningful coverage of listed functions, not a numeric line-coverage percentage). WHERE staying within the 120-second execution bound from criterion 24 would otherwise be violated, THE upper bound on test count SHALL be reduced (down to but not below the 10-test minimum) so that criterion 24 takes precedence over criterion 22's upper bound.
23. WHEN `npm run test` is executed at the end of this work item, THE Test_Suite SHALL exit with code 0.
24. WHILE any test in the files listed in criteria 1, 5, 11, and 18 is executing, THE Test_Suite SHALL NOT make outbound network requests, real Supabase client calls, real AI provider calls, or filesystem writes outside the Vitest temp directory; all such collaborators SHALL be replaced by in-process doubles, and `npm run test` SHALL complete in non-watch mode within 120 seconds on a stock `ubuntu-latest` runner with a warm npm cache.

---

### Requirement 2: Resolve high and critical `npm audit` findings

**User Story:** As a maintainer, I want every high and critical vulnerability reported by `npm audit` to be resolved or formally documented, so that the project does not ship known-exploitable dependencies.

#### Acceptance Criteria

1. WHEN this work item starts, THE Phase_1_Output SHALL contain a file `.kiro/specs/phase-1-foundations/audit-baseline.json` capturing the verbatim JSON output of `npm audit --json` against the current `package-lock.json` (the baseline).
2. WHEN remediation is complete, THE Phase_1_Output SHALL contain a file `.kiro/specs/phase-1-foundations/audit-final.json` capturing the verbatim JSON output of `npm audit --json` after fixes have been applied.
3. WHEN `npm audit --json` is executed against the post-remediation `package-lock.json`, THE Audit_Tool SHALL report `metadata.vulnerabilities.high === 0` AND `metadata.vulnerabilities.critical === 0`.
4. WHERE a High_Severity_Finding cannot be resolved without a breaking dependency upgrade, THE Phase_1_Output SHALL contain an entry in `.kiro/specs/phase-1-foundations/audit-deferred.md` recording the package name, advisory ID (GHSA or CVE), severity, the breaking change required, and a justification for deferral of at least 100 characters.
5. THE remediation work SHALL NOT modify any source code outside `package.json` and `package-lock.json` unless a dependency upgrade requires a call-site update at sites whose imported symbols' signatures or imports have changed; in that case the change SHALL be limited to the minimum necessary to compile and pass tests, and SHALL NOT include unrelated refactors in the same commit.
6. WHEN `npm run lint`, `npm run lint:api`, and `npm run test` are executed against the post-remediation tree on a clean checkout with dependencies installed via `npm ci`, THE Quality_Gate_Commands SHALL all exit with code 0 within 10 minutes of wall-clock time each.
7. THE total count of `low`-severity findings reported by `npm audit --json` against the post-remediation `package-lock.json` SHALL be less than or equal to the count in `audit-baseline.json`, and the count of `moderate`-severity findings SHALL also be less than or equal to the baseline (incidental reductions caused by high/critical fixes are permitted; intentional remediation of low/moderate findings is out of scope for this phase).
8. IF `npm audit --json` reports a `critical` or `high` finding that has no published fix at the time of remediation, THEN THE Phase_1_Output SHALL document the finding in `.kiro/specs/phase-1-foundations/audit-deferred.md` with the same fields required by criterion 4 plus a URL pointing to the upstream issue or advisory page, before criterion 3 is evaluated.
9. THE `audit-baseline.json` file SHALL be committed before any modification to `package.json` or `package-lock.json` is made for this work item, and `audit-final.json` SHALL be generated by re-running `npm audit --json` against the post-remediation `package-lock.json` on the same Node.js major version as recorded in `audit-baseline.json`'s `metadata.platform` (or the Node.js version pinned by Requirement 4 if `metadata.platform` is absent), so that the two reports are directly comparable.
10. WHERE no High_Severity_Finding requires deferral after remediation, THE `audit-deferred.md` file MAY be omitted; otherwise it SHALL be created with one entry per deferred finding.

---

### Requirement 3: Consolidate the database schema into Supabase migrations

**User Story:** As a new contributor, I want a single source of truth for the database schema, so that running `supabase db reset` produces a working environment without my having to discover and order three legacy SQL files.

#### Acceptance Criteria

1. THE Phase_1_Output SHALL create the directory `supabase/migrations/` and populate it with between 3 and 10 timestamp-prefixed migration files that together reproduce the contents of the Legacy_Schema_Files in their documented application order.
2. THE migration filenames SHALL match the regex `^[0-9]{14}_[a-z0-9_]{1,60}\.sql$` (Supabase CLI convention) so that lexicographic sort order matches the documented application order of the Legacy_Schema_Files.
3. WHEN `supabase db reset` is executed against a fresh local Supabase instance using the new Migration_Folder, THE Reset_Command SHALL exit with status 0 within 300 seconds.
4. THE migration set SHALL preserve every database object currently defined by the Legacy_Schema_Files: every table listed in `supabase-schema-v2.sql`, every RLS policy in `supabase-schema-v2.sql` and `scripts/rls-audit.sql`, the storage bucket policies on `storage.objects`, the trigger `update_advisor_sessions_updated_at`, and the functions `update_updated_at_column`, `is_admin`, `increment_field_report_comments`, `record_and_count_rate_limit`, and `cleanup_old_rate_limits` (with its trigger `trigger_cleanup_rate_limits` on `rate_limits`).
5. THE migration set SHALL NOT introduce any new table, column, index, RLS policy, function, trigger, or grant that does not exist in the Legacy_Schema_Files; conversely, it SHALL NOT drop any object defined there.
6. WHEN a fresh database is initialized by applying every file in `supabase/migrations/` in lexicographic order, the resulting schema SHALL be equivalent to a fresh database initialized by applying the Legacy_Schema_Files in their documented order, where "equivalent" means: the same set of tables with the same columns, types, defaults, and constraints; the same set of RLS policies (matched by `(schemaname, tablename, policyname, cmd)` with `qual` and `with_check` compared after collapsing all whitespace runs to a single space); the same set of functions (matched by `(schema, name, argument types)` with return type, language, volatility, security mode, and body text compared after collapsing whitespace); the same set of triggers (matched by `(table, name)`); and the same set of grants and revokes (matched by `(grantee, privilege_type, object_schema, object_name)`).
7. THE Phase_1_Output SHALL contain a document at `.kiro/specs/phase-1-foundations/migration-equivalence.md` that specifies the exact capture commands (e.g., `pg_dump --schema-only`), the normalization steps applied to each dump (whitespace collapsing, sort ordering of policy/function/trigger/grant statements), the exact diff command, and the expected result (an empty diff or whitespace-only diff), such that any maintainer can reproduce the equivalence check end-to-end.
8. THE Legacy_Schema_Files SHALL remain on disk after this phase ships; each file SHALL begin (as its first non-empty content) with a comment block stating that the file is deprecated, naming the Migration_Folder as the current source of truth, and recording that deletion is deferred by one release cycle.
9. WHERE the Supabase CLI requires a `supabase/config.toml` to recognize the migrations directory, THE Phase_1_Output SHALL include that file with the minimum configuration needed for `supabase db reset` to succeed against a fresh local Supabase instance.
10. IF any migration file fails to apply on a fresh database during `supabase db reset`, THEN the migration consolidation SHALL be considered incomplete, the Reset_Command stdout and stderr SHALL be captured verbatim in the spec output for diagnosis, AND no migration file SHALL be modified by the failed run.
11. WHEN every API handler under `api/` and every database-touching call site under `src/` is exercised against the migrated schema with no source-code changes, THE handlers SHALL return responses with the same HTTP status and the same response body shape (same top-level keys and value types) as the same handlers exercised against a database initialized from the Legacy_Schema_Files.
12. THE migration files SHALL contain only plain SQL statements with no environment-specific values (no project IDs, hostnames, or credentials inlined) and no references to undefined external roles beyond the Postgres roles already used by the Legacy_Schema_Files (`anon`, `authenticated`, `service_role`, `postgres`); WHEN `supabase db reset` is executed against a fresh local Supabase instance with default seed data only, THE Reset_Command SHALL leave the database in a state where every RLS policy listed in criterion 4 returns a row from `pg_policies` lookup by `(schemaname, tablename, policyname)`.
13. IF the equivalence check defined in criteria 6 and 7 produces a non-empty, non-whitespace-only diff, THEN the migration consolidation SHALL be considered incomplete, the diff output SHALL be captured verbatim in the spec output, AND no migration file SHALL be modified by the failed equivalence run.

---

### Requirement 4: Minimal GitHub Actions CI workflow

**User Story:** As a maintainer, I want every push and pull request against `main` to run the project's lint and test commands automatically, so that broken code is caught before merge.

#### Acceptance Criteria

1. THE Phase_1_Output SHALL contain a file at `.github/workflows/ci.yml` that defines a single GitHub Actions workflow with a single job named `ci`.
2. THE CI_Workflow SHALL trigger on `push` events whose target branch is exactly `main` and on `pull_request` events whose base branch is exactly `main`, and SHALL NOT trigger on any other branch, tag, or event type.
3. THE CI_Workflow SHALL run on `ubuntu-latest` and SHALL declare a job-level timeout of 15 minutes.
4. THE CI_Workflow SHALL select the Node.js version using this resolution order: (a) the value of `engines.node` in `package.json` if present and resolvable to a single major version, otherwise (b) Node.js major version 20, and SHALL pin the resolved version as an explicit `node-version` value (for example `20.x`) in the workflow file, and SHALL NOT use the values `node`, `latest`, or `*`.
5. WHEN the CI_Workflow job starts, THE CI_Workflow SHALL execute the Quality_Gate_Commands in this exact order, each as a separate step: (1) `npm ci`, (2) `npm run lint`, (3) `npm run lint:api`, (4) `npm run test`, after first checking out the repository at the triggering commit.
6. IF any of the Quality_Gate_Commands exits with a non-zero status, THEN THE CI_Workflow SHALL mark the job as failed and SHALL NOT execute any subsequent Quality_Gate_Commands within the same job.
7. THE CI_Workflow SHALL configure an npm dependency cache whose primary cache key includes the runner OS identifier and the SHA-256 (or equivalent `hashFiles`) hash of `package-lock.json`, such that a run whose `package-lock.json` is byte-identical to a previously cached run reuses the cached `~/.npm` directory and skips redundant downloads.
8. THE CI_Workflow SHALL NOT execute any of the following: `npm run build`, `vite build`, any deployment command, any command that publishes artifacts to an external service, or any command that reads a value from a repository secret.
9. THE CI_Workflow SHALL complete successfully on a fresh fork of the repository with zero repository secrets, zero environment variables beyond GitHub Actions defaults, and zero manual configuration steps.
10. WHEN a pull request is opened or updated against `main` and every Quality_Gate_Command exits with status 0 in the workflow run, THE CI_Workflow SHALL report a successful check named `ci` on that pull request within the job timeout defined in criterion 3.
11. WHEN a pull request is opened or updated against `main` and any Quality_Gate_Command exits with a non-zero status in the workflow run, THE CI_Workflow SHALL report a failed check named `ci` on that pull request, with the failed step identifiable in the run logs.
12. THE CI_Workflow SHALL declare `permissions: contents: read` at the workflow or job level and SHALL NOT request any write permission on the `GITHUB_TOKEN`.
13. WHEN the CI_Workflow runs against an unchanged `package-lock.json` with a warm npm cache, THE CI_Workflow SHALL complete (success or failure) within 10 minutes of wall-clock time per job, and IF a job exceeds the 15-minute timeout declared in criterion 3, THEN THE CI_Workflow SHALL report a failed check rather than hang.

---

### Requirement 5: Cross-cutting constraints for Phase 1

**User Story:** As a maintainer of a live product, I want guarantees that Phase 1 does not change runtime behaviour, so that I can ship its work items independently and roll back any one of them without coordinating with the others.

#### Acceptance Criteria

1. THE Phase_1_Output SHALL NOT modify any user-visible behaviour of the application, defined as: the rendered DOM tree of any route under the same input (no UI changes); the HTTP status code, response headers, or top-level response body shape of any endpoint under `/api/` (no API contract changes); the contents of any row in any database table beyond what the Legacy_Schema_Files already produce on a fresh database (no row-content changes from migration); the exact string of any AI system prompt or the model name selected for any request (no AI prompt or model selection changes); and the list of redirects, callbacks, and required parameters in the auth flow (no auth flow changes).
2. WHEN the full test suite (`npm run test`) is executed against the codebase before any Phase 1 work item is applied AND again after each Phase 1 work item is applied, THE Test_Suite SHALL exit with code 0 in every run; the test environment SHALL be the one defined in Requirement 1 criterion 24 (no real network, no real Supabase, no real AI provider, no filesystem writes outside the Vitest temp directory).
3. THE four work items defined in Requirements 1, 2, 3, and 4 SHALL be independently shippable: any one of them may be merged without requiring the other three to be present, and reverting any one of them SHALL leave the other three in a working state.
4. THE Phase_1_Output SHALL include a README at `.kiro/specs/phase-1-foundations/README.md` of at least 200 words that records the recommended sequencing — tests (Requirement 1) → CI (Requirement 4) → migrations (Requirement 3) → audit (Requirement 2) — and explains both that the order is a recommendation rather than a hard dependency and the rationale for each step's position in the sequence.
5. THE "done" criterion for each work item SHALL be objectively checkable from artefacts in the repository:
   - Requirement 1 done iff the test files described in 1.1, 1.5, 1.11, and 1.18 exist, contain between 10 and 25 newly added test cases as required by 1.22, and `npm run test` exits 0 within the time bound in 1.24.
   - Requirement 2 done iff `audit-baseline.json` and `audit-final.json` exist, `audit-final.json` reports zero high and zero critical vulnerabilities, and any deferred items are recorded in `audit-deferred.md` per criterion 4 (or `audit-deferred.md` is correctly omitted per criterion 10).
   - Requirement 3 done iff `supabase/migrations/` contains 3–10 migration files matching the filename regex in 3.2, `supabase db reset` exits 0 within 300 seconds against a fresh local instance, and the equivalence procedure in `migration-equivalence.md` produces an empty (or whitespace-only) diff.
   - Requirement 4 done iff `.github/workflows/ci.yml` exists, the workflow's most recent run on `main` is green, the workflow file matches every constraint in Requirement 4, and the wall-clock time bound in 4.13 is observed in practice.
6. WHERE a Phase 1 work item touches files outside its declared scope (Requirement 1's scope is the test files listed plus any minimal Vitest config changes; Requirement 2's scope is `package.json` and `package-lock.json` plus call-site updates per criterion 2.5; Requirement 3's scope is `supabase/migrations/`, `supabase/config.toml`, and the deprecation comment blocks on the Legacy_Schema_Files; Requirement 4's scope is `.github/workflows/ci.yml`), THE change SHALL be limited to the minimum necessary to make the work item pass and SHALL be called out in the pull request description with a one-line justification.
7. IF any Phase 1 work item is found during review to change runtime behaviour as defined in criterion 1, THEN that work item SHALL be reverted (by `git revert` of its merge commit, restoring the prior state) or revised before merge regardless of test results, and the revert decision SHALL be recorded in the pull request comments.
