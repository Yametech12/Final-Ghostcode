# Archived: 2026 Q3 TODO List

> **STATUS: COMPLETE — ALL ITEMS DONE.**
>
> **Archived: 2026-09-26**
> **Originally from:** `TODO.md` at the repository root
> **Original purpose:** a working list of TypeScript compile errors to fix
> **Why it was archived:** every listed item had already been fixed, but the file
> was still sitting at the repository root looking like an active work queue. A
> reader had no way to tell it was stale, so it cost time — the specific cost
> being that a contributor could spend an afternoon on an error that no longer
> existed.
>
> The canonical record of what changed is now
> [`../../CHANGELOG.md`](../../CHANGELOG.md). This file is kept only for
> provenance: it establishes that these errors *were* real and that they *were*
> addressed. Original text is preserved verbatim below.

---

## Original content (verbatim)

```markdown
# TODO - Fix console errors / build errors

- [ ] Replace missing `cn()` usage by importing/defining `cn` in `src/components/Layout.tsx` (currently not imported, causing TS2304).
- [ ] Fix `src/pages/AdvisorPage.tsx` reaction state typing: `setMessageReactions` currently allows `undefined` but state type does not.
- [ ] Fix `src/pages/AssessmentPage.tsx` / `src/pages/ProfilerPage.tsx` calls to `safeParseJSON` where the first argument is `string | null`.
- [ ] Fix `src/pages/CalibrationPage.tsx` type inference issues around `data.result?.tasks` being inferred as `never`.
- [ ] Fix `src/utils/errorHandling.ts` serialization: spreading `err as Record<string, unknown>` from an Error causes TS2352.
- [ ] Re-run `npm run lint` (tsc) until clean.
- [ ] Start dev server (`npm run dev`) and re-check browser console at `http://localhost:5173/#`.
```

---

## Disposition of each item

Verified against the working tree at commit
`37c2505f487fd1d43ab73eb7ec3d909767e7546f` (2026-09-12).

| # | Item as written | Status | What actually happened |
| --- | --- | --- | --- |
| 1 | Missing `cn()` import in `src/components/Layout.tsx` (TS2304) | ✅ Fixed | `cn` was **defined locally** rather than imported. The local definition was removed and `import { cn } from '../lib/utils'` added; the now-unused `clsx`, `ClassValue`, and `twMerge` imports came out with it. **Path correction:** the file is `src/components/layout/Layout.tsx` (lowercase directory) — the path in the original entry never existed. |
| 2 | `AdvisorPage.tsx` reaction state typing | ✅ Fixed | State widened from `Record<string, 'like' \| 'dislike'>` to `Record<string, 'like' \| 'dislike' \| undefined>`, which is what the toggle actually needs: setting `undefined` is how a reaction is cleared. |
| 3 | `safeParseJSON` called with `string \| null` | ✅ Fixed at the source | The function signature was corrected to `safeParseJSON<T>(text: string \| null, fallback: T): T`. Fixing the signature fixes every call site at once — the right response, and better than the entry's suggestion of patching each caller. |
| 4 | `CalibrationPage.tsx` — `data.result?.tasks` inferred as `never` | ✅ Fixed | Explicit type parameters added at the two `safeParseJSON` call sites so inference had something to work with. |
| 5 | `errorHandling.ts` — spreading an `Error` caused TS2352 | ✅ Fixed | The spread was replaced with explicit `name`/`message`/`stack` assignment plus `Object.keys(err).forEach(...)` for custom properties. **Note:** this replaced one unsafe cast with a `Record<string, any>` — it compiles, and it is not a type-safe solution. A cleaner version narrows the unknown keys instead of casting. |
| 6 | Re-run `npm run lint` until clean | ✅ Done | `tsc --noEmit` exits `0` on both projects (`lint`, `lint:api`). |
| 7 | Re-check the browser console via `npm run dev` | ✅ Done | Recorded as clean in `FIXES_APPLIED.md`. |

---

## Why this file was moved instead of deleted

Deleting it would have been tidier. It was archived instead because the file is
the only surviving evidence that these five specific errors existed and that the
fixes were deliberate — and because the *pattern* is worth preserving:

> Every one of these five errors was a **type-system complaint about a real
> defect**. `cn` was genuinely missing. The reaction toggle genuinely needed to
> express "no reaction". `safeParseJSON` was genuinely being handed `null` from
> `localStorage`. None was a false positive, and "make the compiler stop
> complaining" would have hidden five real bugs rather than fixed them.

That is the useful thing to carry forward, and it is the reason the archived list
is more valuable than its (now empty) checkboxes.

---

## Where this work is tracked now

| Need | Destination |
| --- | --- |
| What changed and when | [`../../CHANGELOG.md`](../../CHANGELOG.md) |
| **Currently open** structural work | [`../../STRUCTURE.md`](../../STRUCTURE.md) §10 |
| Currently open issues | [`../../CHANGELOG.md`](../../CHANGELOG.md) → *Known issues (recorded, not fixed)* |
| How to pick up work | [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| Why documentation drift is treated as a defect | [`../README.md`](../README.md) |

**Do not add new items to this file.** New work belongs in an issue. A to-do file
in a repository is invisible to anyone who is not already reading the repository —
which is the entire population of people who need to know what is left to do.

---

**Last verified: 2026-09-26** · **Status: archived, fully complete**
