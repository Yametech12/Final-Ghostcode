# TODO - Fix console errors / build errors

- [ ] Replace missing `cn()` usage by importing/defining `cn` in `src/components/Layout.tsx` (currently not imported, causing TS2304).
- [ ] Fix `src/pages/AdvisorPage.tsx` reaction state typing: `setMessageReactions` currently allows `undefined` but state type does not.
- [ ] Fix `src/pages/AssessmentPage.tsx` / `src/pages/ProfilerPage.tsx` calls to `safeParseJSON` where the first argument is `string | null`.
- [ ] Fix `src/pages/CalibrationPage.tsx` type inference issues around `data.result?.tasks` being inferred as `never`.
- [ ] Fix `src/utils/errorHandling.ts` serialization: spreading `err as Record<string, unknown>` from an Error causes TS2352.
- [ ] Re-run `npm run lint` (tsc) until clean.
- [ ] Start dev server (`npm run dev`) and re-check browser console at `http://localhost:5173/#`.

