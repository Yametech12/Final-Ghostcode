# Contributing to Epimetheus

Last verified: 2026-09-26

Thanks for taking the time to contribute. This document covers the mechanics:
how to set up the project, what the code standards are, and how a change gets
merged.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).
Found a security issue? Do **not** open a public issue — follow
[`SECURITY.md`](./SECURITY.md) instead.

---

## 1. Before you start

- **Check for an existing issue.** Search open and closed issues first.
- **Open an issue before large work.** For anything larger than a bug fix or a
  small refactor, open an issue describing the problem and your intended
  approach. This avoids two people building the same thing differently.
- **Small PRs merge faster.** One logical change per pull request. A PR that
  touches 40 files and three concerns is hard to review and will sit.
- **No drive-by reformatting.** Do not reformat files you are not otherwise
  changing. It buries the real diff.

### Good first contributions

- Adding tests for existing uncovered behaviour. Test coverage is the single
  largest gap in this codebase.
- Fixing a documented item from the *Unreleased* section of
  [`CHANGELOG.md`](./CHANGELOG.md).
- Improving typing — replacing `any` with a real type or `unknown` plus a
  narrowing check.
- Documentation corrections where the docs disagree with the code.

---

## 2. Development environment

### Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | **>= 20.0.0** | Enforced by the `engines` field in `package.json`. Node 22 LTS is recommended. |
| npm | 10+ | The lockfile is `package-lock.json`; do not use yarn or pnpm. |
| Supabase project | any | The free tier is sufficient. You need the URL, anon key, and service-role key. |
| Regolo AI API key | — | <https://regolo.ai>. Server-side only. |

> Node 18 will *probably* work but is untested and unsupported. The repo's own
> README previously said "Node 18+" while nothing pinned a floor — the
> `engines` field now states a floor explicitly.

### Setup

```bash
# 1. Fork the repository on GitHub, then clone YOUR fork.
git clone https://github.com/<your-username>/Final-Ghostcode.git
cd Final-Ghostcode

# 2. Install exact locked dependencies.
npm ci

# 3. Create your local env file and fill it in.
cp .env.example .env

# 4. Apply the database schema, in lexicographic order.
#    With the Supabase CLI:
supabase db reset
#    Without it: paste each file in supabase/migrations/ into the SQL editor,
#    oldest first. Do not run the legacy root-level SQL files.

# 5. Start both servers (frontend 5173 + API 3000).
npm run dev
```

### Required vs optional environment variables

The four variables without which the app cannot boot:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
REGOLO_API_KEY
```

Everything else is optional. The full annotated list — purpose, required/optional
status, and the `VITE_` prefix rules — is in the **Environment variables** table
in [`README.md`](./README.md). Read the prefix rule before adding a variable:

> **A server secret must never be `VITE_`-prefixed.** Vite inlines every
> `VITE_*` variable into the client bundle at build time. `vite.config.ts`
> contains a build-time guard that aborts the build if a forbidden name
> appears, but do not rely on it as your only defence — understand why the rule
> exists.

### Everyday commands

```bash
npm run dev              # frontend + API concurrently
npm run dev:frontend     # Vite only
npm run dev:api          # Express only
npm run lint             # tsc --noEmit (frontend)
npm run lint:api         # tsc --noEmit (api)
npm run lint:all         # both type-checks — run this before pushing
npm run build            # production build + service-worker version stamp
npm test                 # vitest, single run
npm run test:watch       # vitest, watch mode
npm run diagnose         # env + Supabase smoke test
```

**The full pre-push gate is:**

```bash
npm run lint:all && npm test && npm run build
```

All three must pass. CI runs the same three steps.

---

## 3. Architecture in one paragraph

A React 19 + Vite 6 single-page app in `src/`, talking to a small API in `api/`.
The API ships as a **shared handler module** (`api/lib/handlers.ts`) that is
mounted by two entry points: an Express 5 dev server (`api/_index.ts`) and a
Vercel serverless function (`api/server.ts`). Both call the same handlers, which
is what prevents dev/prod behaviour drift — if you add a route, add it in the
handler module and wire it in **both** entry points. Data lives in Supabase
Postgres; AI calls go to Regolo. See [`docs/architecture/README.md`](./docs/architecture/README.md).

---

## 4. Coding standards

### TypeScript

- **Strict mode is on.** Do not weaken `tsconfig.json` to make an error go away.
- **`any` is a last resort.** Prefer a real type. When the shape genuinely is
  unknown or comes from an untrusted boundary, use `unknown` and narrow it:

  ```ts
  // ✗ Avoid — disables every downstream check.
  function parse(input: any) { return input.user.id; }

  // ✓ Prefer — forces you to prove the shape.
  function parse(input: unknown) {
    if (typeof input !== 'object' || input === null) throw new ValidationError('not an object');
    const user = (input as Record<string, unknown>).user;
    if (typeof user !== 'object' || user === null) throw new ValidationError('missing user');
    return (user as Record<string, unknown>).id;
  }
  ```

  `any` still exists in this codebase — treat each remaining occurrence you
  touch as an opportunity to remove one, not a licence to add another.
- **Validate at the boundary, then trust inward.** Untrusted input (request
  bodies, query params, `localStorage`, upstream AI responses) gets validated
  once, on entry, and the validated value is what flows onward.
- **No non-null assertions on anything a request can influence.** `foo!.bar`
  on data that originates outside the process is a latent 500.
- **Server-only values must never reach `src/`.** If a type or constant is
  needed by both sides, duplicate the type deliberately rather than importing
  across the `api/` ↔ `src/` boundary — that boundary is enforced by two
  separate TypeScript projects (`tsconfig.json` and `tsconfig.api.json`).

### React

- Function components and hooks only. No class components except error
  boundaries, which React requires to be classes.
- **Obey the Rules of Hooks.** Anything in a `useEffect` dependency array that
  is read inside the effect belongs in the array. Do not silence the
  `react-hooks/exhaustive-deps` warning by deleting the dependency — fix the
  effect, or move the value into a ref *and document why*.
- **Guard against setState-after-unmount** for anything async. Use the
  existing patterns in `src/hooks/` rather than inventing a new one.
- **Extract at ~200 lines.** The codebase has a real problem with oversized
  route components. If you are *adding* to a page that is already past several
  hundred lines, consider extracting first.
- **Memoise deliberately.** Wrap a component in `React.memo` when it re-renders
  often with stable props — not reflexively. Measure before and after.

### Styling

- **Tailwind 4 is the styling system.** Prefer utility classes in JSX.
- **Use semantic tokens, never raw colour literals.** Write
  `bg-mystic-900` / `text-slate-400` / `var(--color-status-error)`, never
  `#0a0508` or `rgba(0,0,0,0.65)` in a component. Hard-coded literals do not
  flip when the light theme activates, which is exactly how the light theme
  ended up with unreadable text. Colour values live in one place: the token
  layer in `src/index.css`.
- **Colour must be paired with something else.** Never signal state by colour
  alone — add an icon, a label, or a shape, so the meaning survives for someone
  who cannot distinguish the two colours.
- **Contrast**: body text ≥ 4.5:1, large text ≥ 3:1, against its actual
  background, in **both** themes. Check the light theme specifically — it is the
  weaker of the two.
- **Every icon-only control needs an `aria-label`.** No exceptions. A `<button>`
  containing only an `<svg>` announces as "button" to a screen reader.
- **Every form control needs a linked label**: `<label htmlFor="x">` plus
  `<input id="x">`. A placeholder is not a label — it disappears on input and is
  not announced reliably.
- **Prefer `100dvh` over `100vh`** for full-height mobile layouts, with a
  `100vh` fallback for older engines.

### Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Component file & export | `PascalCase` | `ProfileCard.tsx` → `ProfileCard` |
| Hook | `use` + `PascalCase` | `useAdvisorChat` |
| Boolean | `is` / `has` / `should` prefix | `isLoading`, `hasUnread` |
| Handler prop | `on` + event | `onToggleTheme` |
| Local handler | `handle` + event | `handleSubmit` |
| Constant | `SCREAMING_SNAKE_CASE` | `RATE_WINDOW` |
| Type / interface | `PascalCase`, no `I` prefix | `AnalysisResult` |
| Test file | co-located, `.test.ts` | `json.test.ts` |

### Commits

Conventional Commits. This is not decoration — it is what makes the changelog
maintainable.

```
<type>(<optional scope>): <imperative summary, lower case, no trailing period>

<optional body: what and why, not how>

<optional footer: BREAKING CHANGE: …, Closes #123>
```

Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
`ci`, `chore`, `revert`, `style`.

```
feat(advisor): stream token counts into the session header
fix(auth): resolve userId server-side instead of trusting the body
perf(routes): drop AnimatePresence mode="wait" to unblock navigation
docs(readme): correct the page count and the schema source of truth
```

Rules:

- Subject is imperative ("add", not "added" or "adds").
- Subject ≤ 72 characters.
- One logical change per commit. If you need "and" in the subject, you probably
  want two commits.
- A `BREAKING CHANGE:` footer is mandatory for anything that changes an API
  contract, an env var name, or a database column.

### Tests

- **Co-locate** the test next to the file it tests: `json.ts` → `json.test.ts`.
- **Vitest + Testing Library.** No new test runner.
- **Every bug fix ships with a regression test** that fails before the fix.
- **Every new server-side handler ships with a test.** The `api/` tree is the
  security boundary; it is the worst possible place for untested code.
- Prefer testing behaviour over implementation. Assert what the function does,
  not which internal function it called.
- Do not add a test that cannot fail. A test with no assertion, or one that
  asserts a mock was called without ever exercising real logic, is noise.

Current baseline (run it yourself before trusting this number):

```bash
npx vitest run
```

> The exact test-file and test-count figures change with every PR. Rather than
> copy a number that will go stale, run the command. The count is asserted in
> CI, so a PR that breaks a test cannot merge.

---

## 5. Fork & pull request workflow

```bash
# 1. Fork on GitHub, then clone your fork.
git clone https://github.com/<your-username>/Final-Ghostcode.git
cd Final-Ghostcode
git remote add upstream https://github.com/Yametech12/Final-Ghostcode.git

# 2. Branch off an up-to-date main. Never work on main.
git fetch upstream
git checkout -b fix/advisor-pagination upstream/main

# 3. Work, committing as you go.
git add -A && git commit -m "fix(advisor): return the newest messages, not the oldest"

# 4. Sync before opening the PR (rebase, not merge).
git fetch upstream && git rebase upstream/main

# 5. Run the full gate. All three must pass.
npm run lint:all && npm test && npm run build

# 6. Push to YOUR fork and open the PR against Yametech12:main.
git push -u origin fix/advisor-pagination
```

### Branch naming

| Prefix | Use for |
| --- | --- |
| `feat/` | New user-visible capability |
| `fix/` | Bug fix |
| `perf/` | Performance work |
| `refactor/` | Behaviour-preserving restructuring |
| `docs/` | Documentation only |
| `chore/` | Tooling, deps, housekeeping |
| `security/` | Security fix — say so, so it is reviewed with the right urgency |

### The pull request

Fill in [the PR template](./.github/PULL_REQUEST_TEMPLATE.md). A reviewable PR
answers four questions:

1. **What changed?** — one paragraph.
2. **Why?** — link the issue.
3. **How was it verified?** — paste the actual output of
   `npm run lint:all && npm test && npm run build`. "Tests pass" without the
   output is not verification.
4. **What is the risk?** — what could this break, and what did you check?

Keep the PR description and the commits consistent. Reviewers read both.

### Review expectations

- **A maintainer will respond within about 5 business days.** If you have heard
  nothing after a week, a single polite ping is welcome — assume the
  notification was missed.
- **Two approving reviews** are required for changes to `api/`,
  `supabase/migrations/`, or anything touching auth.
- **CI must be green.** A red check means the PR is not ready for review, not
  that the reviewer should figure out why.
- **Address or answer every comment.** If you disagree, say why — a reasoned
  pushback is a contribution. Silence is not.
- **Squash-merge is the default.** Write the PR title as you would a commit
  subject, because it becomes the merge commit.

### What gets a PR closed

- Fails CI.
- No tests for a bug fix, or no tests for a new handler.
- Reformatting unrelated files.
- Introducing `any` where `unknown` was sufficient.
- Adding a raw colour literal or a hard-coded `#hex` in a component.
- Committing a `.env` file, a real secret, or a build artifact (`dist/`,
  `tsconfig.tsbuildinfo`).
- Claiming a fix without evidence that it works.

---

## 6. Database changes

Schema changes go in `supabase/migrations/` as new timestamped files. Do not
edit an already-applied migration, and do not add to the legacy root-level SQL
files — they are not applied by anything and survive only for one release cycle.

A migration that adds a table must, in the same file:

1. `CREATE TABLE` with the constraint that actually matters.
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` — an RLS-free public table is a
   data breach waiting for a URL.
3. Policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` with **both** `USING`
   and `WITH CHECK` where the policy is not read-only. A `USING` clause alone
   lets a user *move* a row out of their own scope.
4. Indexes for every column used in a policy predicate or a hot query filter.
5. A grant strategy: nothing is public unless you decided it should be.

Never grant column-level write access to a privileged column (`role`,
`subscription_tier`, `subscription_expires_at`) through a direct policy. Protect
it with a trigger or route the write through the service role.

---

## 7. Adding a new API route

1. Write the handler in `api/lib/handlers.ts` (or a new domain module it
   re-exports) taking a `NormalizedRequest` and returning a
   `NormalizedResponse`.
2. Derive the caller's identity server-side via `getAuthenticatedUser`. Never
   read a `userId` from the body or query.
3. Validate and clamp every untrusted field before it reaches Supabase.
4. Wire it in **both** `api/_index.ts` (Express) and `api/server.ts` (Vercel).
   Forgetting one is the most common way this codebase drifts.
5. Add a test in `api/lib/handlers.test.ts` covering: unauthenticated, wrong
   role, malformed body, and the happy path.
6. Document it in the API reference table in [`README.md`](./README.md) and in
   `docs/architecture/README.md`.

---

## 8. Questions

Open a GitHub Discussion or an issue with the `question` label. There is no
chat server, and no private support channel for contributors.

---

## 9. Licence

By contributing you agree that your contributions are licensed under the
[MIT Licence](./LICENSE). Do not submit code you do not have the right to
license this way, and do not copy code from a project under an incompatible
licence.
