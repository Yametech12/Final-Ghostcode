# TODO - Fix console errors / build errors

## Previously reported bugs — resolved (verified: `npm run lint`, `npm run lint:api`, `npm test`, `npm run build` all pass)

- [x] Replace missing `cn()` usage by importing/defining `cn` in `src/components/Layout.tsx` (TS2304). — fixed, see `FIXES_APPLIED.md`
- [x] Fix `src/pages/AdvisorPage.tsx` reaction state typing (`setMessageReactions` / `undefined`). — fixed
- [x] Fix `safeParseJSON` calls in `src/pages/AssessmentPage.tsx` / `src/pages/ProfilerPage.tsx` where the first arg is `string | null`. — fixed (signature now accepts `string | null`)
- [x] Fix `src/pages/CalibrationPage.tsx` type inference around `data.result?.tasks` / `safeParseJSON` generics. — fixed
- [x] Fix `src/utils/errorHandling.ts` error serialization (`TS2352` spread of `Error`). — fixed

## Dependency audit — resolved (this pass)

- [x] Production tree (`npm audit --omit=dev`): 0 vulnerabilities (was 20, incl. 1 critical + 9 high).
  - `@vercel/node` moved to `devDependencies` (types-only; never bundled at runtime) and bumped to v16 — removes the vulnerable `undici`/`tar` subtree from the prod tree.
  - `ws` (high, via `@supabase/realtime-js`) patched in the lockfile.
  - Dev-tree-only advisories remain in `@vercel/node`'s tooling deps; they do not ship to production. Re-run `npm audit` periodically.
- Note: `npm install` in this repo needs `--legacy-peer-deps` (npm 10 arborist crashes with `Cannot read properties of null (reading 'edgesOut')` on `jsdom`'s optional `canvas` peer).

## Still open (manual / follow-up)

- [ ] Browser smoke test after a dev run: check the console at `http://localhost:5173/#` for runtime errors (requires a running dev session with Supabase/Regolo env vars).
- [ ] Optional: raise test coverage beyond the current utils (see `DEEP_ANALYSIS.md` → "What still warrants attention").
