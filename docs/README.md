# Epimetheus Documentation

**Last verified: 2026-09-26**

This is the index for the project's documentation. Start here, then follow the
reading path that matches what you are trying to do.

---

## Reading paths

| I want to… | Read |
| --- | --- |
| Understand what this product is | [`../README.md`](../README.md) §1–§4 |
| Run it on my machine | [`../README.md`](../README.md) §5–§6 |
| Understand the architecture | [`architecture/README.md`](./architecture/README.md) |
| Contribute code | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Report a vulnerability | [`../SECURITY.md`](../SECURITY.md) |
| Review the security posture | [`security/threat-model.md`](./security/threat-model.md) |
| Rotate a leaked secret | [`security/secrets-rotation.md`](./security/secrets-rotation.md) |
| Ship a deploy or roll one back | [`operations/deployment.md`](./operations/deployment.md) |
| Investigate a production error | [`operations/monitoring.md`](./operations/monitoring.md) |
| Understand the subscription design | [`billing/stripe-flow.md`](./billing/stripe-flow.md) |
| Know what changed and when | [`../CHANGELOG.md`](../CHANGELOG.md) |
| Find a file in the tree | [`../STRUCTURE.md`](../STRUCTURE.md) |
| Understand the security/complexity posture | [`../DEEP_ANALYSIS.md`](../DEEP_ANALYSIS.md) |

---

## Tree

```
docs/
├── README.md                      ← you are here
├── architecture/
│   └── README.md                  System layers, data model, request lifecycle
├── security/
│   ├── threat-model.md            Assets, controls, threat enumeration
│   └── secrets-rotation.md        Runbook: identify → revoke → reissue → verify
├── billing/
│   └── stripe-flow.md             INTENDED Stripe design — not implemented
├── operations/
│   ├── deployment.md              Deploy, migrate, roll back, verify
│   └── monitoring.md              Sentry, logs, request IDs, health checks
└── archive/
    └── 2026-q3-todos.md           Completed to-do list, kept for provenance
```

---

## Documentation rules

These exist because the repository's documentation had drifted badly — an audit
found 27 discrete errors across five files, including a claimed canonical schema
file that was not canonical and a described directory that never existed.

1. **Every document carries a `Last verified: YYYY-MM-DD` date.** A document
   without a date cannot be trusted or audited, because there is no way to tell
   whether it describes the current code or code from a year ago.
2. **State the commit the document was verified against.** A date alone is not
   enough if the branch moved that day.
3. **Verify against source, not against another document.** Copying a claim from
   a sibling doc propagates the error.
4. **Prefer paths and counts you read to numbers you remember.** If a figure
   changes with every dependency bump (bundle sizes, test counts, `any` counts),
   give the command that produces it instead of the figure.
5. **Mark uncertainty explicitly.** `TBD`, `unverified`, and an "open questions"
   list are honest. A confident wrong answer is worse than an admitted gap —
   someone will act on it.
6. **Record corrections rather than silently editing.** The README, STRUCTURE,
   DEEP_ANALYSIS, and CHANGELOG files each carry a "was claimed / actually"
   section. This lets a reader who trusted the old text discover that they were
   misled, and lets a reviewer verify the fix.
7. **Never commit real user data, a real secret, or an unredacted screenshot.**

---

## Open documentation work

Honest list, so the next contributor does not have to rediscover it.

| Gap | Impact |
| --- | --- |
| **No OpenAPI / Swagger spec** | The API reference is a hand-written table in `README.md`; it can drift from `api/lib/handlers.ts` silently. |
| **No screenshots** | `README.md` §16 lists placeholders. A product README without images is materially weaker at explaining what the thing looks like. |
| **`@param` / `@returns` JSDoc missing on public APIs** | 76 exported components and most exported hooks have no JSDoc block. `README`-level docs cover the shape, not the arguments. |
| **No typedoc build** | No generated API reference for the source tree. |
| **No runbook for a database outage or a Supabase incident** | `operations/` covers deploy and monitoring, not incident response for the data layer. |
| **No data-retention or deletion policy document** | The app stores third-party data in `dossiers` (people who never consented). That deserves a written retention stance, not just a code path. |
| **`docs/billing/stripe-flow.md` documents an unimplemented design** | Clearly marked as such, but the gap between it and reality will keep widening until someone builds it. |
| **No accessibility conformance statement** | Token contrast and control labelling have been addressed in code; no document states the target level or the known exceptions. |

---

**Last verified: 2026-09-26**
