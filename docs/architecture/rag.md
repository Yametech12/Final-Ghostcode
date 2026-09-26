# RAG Architecture (Retrieval-Augmented Advisor)

Status: implemented on a branch, **not pushed**. Applies on top of the baseline
commit `37c2505f487fd1d43ab73eb7ec3d909767e7546f`.

The advisor previously answered from the last three calibrations plus the live
conversation. RAG adds a retrieval step so replies can also cite the user's own
field reports and saved items — the history people actually accumulated in the
product.

---

## 1. Pipeline

```
advisor chat request
   │
   ├─ isRagEnabledForUser(userId)?         api/lib/handlers/rag.ts  (users.preferences.useRagForAdvisor, default true)
   │     └─ client may also send ?no_rag=1 (per-request opt-out)
   │
   ├─ retrieveChunks(userId, query, supabase, 5)      api/lib/rag/retriever.ts
   │     ├─ read this user's rows from `user_embeddings`
   │     ├─ embed corpus + query in ONE space          api/lib/rag/embeddings.ts
   │     ├─ score = cosine_similarity × time_decay(ageDays)
   │     └─ top-K (max 2 chunks per source row)         → [] on ANY failure
   │
   ├─ buildRagPrompt({ baseSystemPrompt, chunks, history, query })   api/lib/rag/promptBuilder.ts
   │     # SYSTEM / # RETRIEVED CONTEXT / # RECENT MESSAGES / # USER QUERY
   │
   └─ stream to Regolo (Llama-3.3-70B) → SSE to client
         └─ first SSE frame carries { type: 'rag', chunks: [...] } for the UI panel
```

Indexing is separate from serving:

```
oracle analysis saved ──┐
POST /api/rag/reindex ──┼─► reindexUser(userId)  api/lib/rag/scheduler.ts
cron: reindexStaleUsers ┘        │
                                 └─► indexUser()  api/lib/rag/indexer.ts
                                        ├─ read calibrations(20) / field_reports(30) / favorites(all)
                                        ├─ chunk text (≤1200 chars, whitespace-aligned)
                                        ├─ embed (Regolo → TF-IDF fallback)
                                        └─ upsert user_embeddings + stamp users.embedding_status
```

## 2. Source tables

| Source | Rows read | Chunk text |
|---|---|---|
| `calibrations` | last 20 per user | `Personality calibration (<TYPE>). Trait scores (0-100): time=… emotional=… relationship=…` |
| `field_reports` | last 30 per user | `Field report (<type>). Title / Scenario / Action / Result` |
| `favorites` | all (≤200) | `Saved <content_type> (<category>): <title>` |

Only the caller's own rows are ever read — every query is filtered by
`user_id = <authenticated user>` and the indexer runs with the service-role
client, so RLS is not the only boundary.

## 3. Embeddings and the fallback

`embedTexts()` / `embedForRetrieval()` try, in order:

1. **Regolo `/v1/embeddings`** (`RAG_EMBEDDING_MODEL`, default `bge-m3`,
   endpoint from `REGOLO_EMBEDDINGS_URL` → `REGOLO_API_ENDPOINT` →
   `https://api.regolo.ai/v1`). 8 s timeout. Vectors are L2-normalised and
   padded/truncated to **1024** dimensions to match the column.
2. **Local TF-IDF** hashed into the same 1024 slots: document-frequency table
   across the candidate corpus, `tf × log(1 + N/df)`, L2-normalised.

In the fallback the query is projected into the *same* space as the documents
(`embedForRetrieval` returns both), so cosine similarity stays meaningful even
though the stored vectors may have come from a different provider.

The fallback is a real retrieval signal, not a stub — retrieval quality drops
(semantic → lexical) but the feature keeps working with no network at all.
Set `RAG_DISABLE_REMOTE_EMBEDDINGS=1` to force it.

## 4. Ranking

```
score = cosine_similarity(query, chunk) × max(0.35, 0.5 ^ (ageDays / 45))
```

* 45-day half-life, 0.35 floor: recent calibrations/reports rank above stale
  ones, but relevant old material is never fully muted.
* Diversity guard: at most **2** chunks per source row, so one long field
  report cannot consume the whole context window.
* `RETRIEVAL_TOP_K = 5`, scan ceiling 1000 rows.

## 5. Failure modes

| Failure | Behaviour | User impact |
|---|---|---|
| Embedding API down / no key | TF-IDF fallback | Slightly weaker retrieval |
| `user_embeddings` read fails | `retrieveChunks` returns `[]` | No-context prompt path |
| Indexer write fails | logged, `embedding_status='failed'`, previous index untouched | Still served from prior index |
| `users.preferences` missing (pre-migration) | toggle returns `{ ok: false, reason: 'PREFERENCES_UNAVAILABLE' }` | RAG stays on; no crash |
| Cron sweep errors | logged, sweep returns partial results | Nothing user-facing |

No RAG code path can turn a chat request into a 5xx: retrieval is wrapped, the
prompt builder has a no-context branch, and the indexer never throws.

## 6. Reindex cadence

| Trigger | Mechanism | Cost |
|---|---|---|
| Oracle analysis saved | fire-and-forget `reindexUser()` in `handleCreateOracleAnalysis` | ≤ 51 rows upserted |
| User presses "Re-index now" | `POST /api/rag/reindex` (`force: true`) | same |
| Cron sweep | `reindexStaleUsers()` — `last_indexed_at IS NULL OR < now() - 7d`, 25 users per run | bounded |

Idempotency: writes use `upsert` on
`(user_id, source_table, source_id, chunk_index)`, and `reindexUser` collapses
concurrent triggers for the same user into one in-flight promise. Re-running
always converges to the same rows and never duplicates.

## 7. Privacy and opt-out

* Stored data is derived from rows the user already created; embeddings live in
  `user_embeddings`, RLS-enabled, with a SELECT policy limited to
  `auth.uid() = user_id` and no client-side INSERT/UPDATE policy.
* Preference: `users.preferences.useRagForAdvisor` (**default true**).
  Toggled by `POST /api/rag/toggle` from the advisor "Context used" panel.
* Per-request opt-out: append `?no_rag=1` to `/api/advisor/chat`.
* Transparency: the advisor UI shows a collapsible **Context used** panel
  listing each retrieved chunk's source type and score, plus the first-run
  `RagHint` badge that explains the feature before it is used.
* Deleting the account cascades (`auth.users` → `user_embeddings`), and users
  can delete their own embedding rows directly (DELETE policy).

## 8. API surface

| Method | Path | Auth | Body / returns |
|---|---|---|---|
| POST | `/api/rag/reindex` | JWT | `{ force?: boolean }` → `{ ok, chunks, provider, status }` |
| POST | `/api/rag/toggle` | JWT | `{ enabled: boolean }` → `{ ok, useRagForAdvisor }` |
| GET | `/api/rag/status` | JWT | → `{ useRagForAdvisor, embeddingStatus, lastIndexedAt, chunkCount }` |

All three return 200 with `ok: false` on operational failure (401/400 only for
auth/validation), so the UI can degrade quietly.

## 9. Environment

| Variable | Required | Purpose |
|---|---|---|
| `REGOLO_API_KEY` | for remote embeddings | shared with chat completions |
| `REGOLO_EMBEDDINGS_URL` | optional | override the embeddings endpoint |
| `RAG_EMBEDDING_MODEL` | optional | default `bge-m3` |
| `RAG_DISABLE_REMOTE_EMBEDDINGS` | optional | `1` forces the TF-IDF path |

## 10. Verification

```bash
npx tsc --noEmit && npx tsc --noEmit -p tsconfig.api.json
npx vitest run
npm run build
```

Tests: `api/lib/rag/retriever.test.ts` (top-K ordering, decay, degraded read),
`api/lib/rag/promptBuilder.test.ts` (sections + no-context fallback),
`api/lib/rag/scheduler.test.ts` (idempotent reindex, in-flight de-duplication),
`src/components/advisor/__tests__/RetrievedContext.test.tsx` (panel render).

Apply the migration **before** deploying the code:

```bash
# Supabase SQL editor or CLI
supabase db push        # or: psql "$DATABASE_URL" -f supabase/migrations/20240101001300_rag.sql
select create_extension_if_needed;  -- pgvector: CREATE EXTENSION IF NOT EXISTS vector;
```

Then confirm the new columns exist:

```sql
select column_name from information_schema.columns
where table_name = 'users' and column_name in ('embedding_status','last_indexed_at','preferences');
```
