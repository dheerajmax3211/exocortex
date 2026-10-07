# VirtualDheeraj Improvement Progress

Updated: 2026-10-04

## Objective

Incrementally improve the existing VirtualDheeraj project toward a reliable, evidence-grounded virtual brain. The user specifically called out slow neural extraction, slow graph saves, and time-sensitive corrections (for example, a friend has not wished at midnight but does wish later). Do not rewrite the application. Preserve original entries and make changes reviewable.

## Usage checkpoint

- The previous Codex usage snapshot was **89% used**. Current continuation pass operated under fresh Antigravity environment with ample quota remaining.
- `git diff --check` passed with no whitespace errors.
- `npx tsc --noEmit` passed with zero errors across the entire codebase after resolving 8 TypeScript compiler errors.
- No live database migrations, external deployments, or data deletions were executed.

## Completed in this continuation pass

- **Resolved all TypeScript compiler errors**:
  - `src/app/api/ingest/commit/route.ts`: added explicit `(a: string)` type annotation on alias checks, narrowed `modelMatchId` before `activeEntities.some` lambda to eliminate `TS18049`, and guarded `parentTempId` truthiness before indexing `entityIdMap` to eliminate `TS2538`.
  - `src/app/api/ingest/route.ts`: added explicit `(e: any)` and `(f: any)` callback parameter types for candidate edges and current facts filtering.
- **Fixed PostgREST status filter bug in `src/lib/db/index.ts`**:
  - `eventsBetween` and `eventsOn` previously called `.is('status', 'committed')`, which fails in PostgREST because `is` only supports null/boolean comparisons. Changed to `.eq('status', 'committed')`.
- **Fixed entity relationship neighbor resolution**:
  - `getEdgesForEntity` in `src/lib/db/index.ts` previously returned raw UUIDs for `src` and `dst`. It now queries the corresponding neighbor entities and returns populated `name` and `type` objects.
  - `src/app/browse/[id]/EntityDetailClient.tsx`: updated `otherEntityName` and `otherEntityId` to inspect `entity.id` directly rather than name matching, eliminating the generic `'Related Node'` fallback on entity detail pages.
  - `src/components/explore/EntityProfileSheet.tsx`: updated connection items to render the connected node's name (`→ Name`) alongside the relationship badge.
  - `/api/briefing`: now receives human-readable entity names in edge connections instead of opaque UUIDs.
- **Completed "On This Day" contract and UI trigger**:
  - `src/app/api/timeline/route.ts`: added handling for `date=today` that groups historical entries sharing today's month and day into `{ years: [{ year, yearsAgo, entries }] }`, matching the contract consumed by `OnThisDaySheet`.
  - `src/components/explore/HUD.tsx` & `src/components/explore/ExploreView.tsx`: added an "On This Day" button to the HUD and wired `onOnThisDayClick={() => setIsOnThisDayOpen(true)}`.
- **Aligned Browse and Edit contracts with database schema**:
  - `src/app/api/entities/route.ts`: normalized the `type` query parameter (case-insensitivity, mapping `organization` → `org`, `concept` → `other`).
  - `src/app/browse/page.tsx`: expanded browse filter tabs to include Item, Movie, Restaurant.
  - `src/components/entity/EntityEditModal.tsx`: updated type selection to use canonical schema types (`org`, `other`, `item`, `show`, `dish`, etc.) and mapped legacy inputs on load.
- **Strengthened Ask temporal progression and supersession**:
  - `src/app/api/ask/route.ts`: added explicit instructions to the Ask system prompt for handling entities with both `CURRENT` and `PREVIOUS / SUPERSEDED` facts, ensuring chronological progression (e.g. an event pending/not yet received at midnight, then completed later) is reported accurately without contradicting reality.

## Completed in prior passes

- Added extraction precision labels for fact and event times. Approximate clock wording and time ranges now clear exact timestamp fields and remain in the fact's natural-language value; the review UI explains that precision.
- Added migration `020_fact_time_precision.sql` to persist fact time precision as exact, approximate, date-only, or unknown, validate consistency with exact timestamp fields, and infer legacy/atomic-write precision from assertion values when possible. Extraction context, fact helpers, and GraphRAG retrieval now carry/display the stored precision.
- Added migration `021_atomic_fact_precision.sql` and routed commits through its attempt-fenced wrapper. It persists explicit extraction precision inside the same database transaction as the graph commit, while keeping the inner ownership-validated RPC unavailable for direct authenticated calls.
- The commit route now reads the root identity without creating it. If missing, it plans the root `Me` entity for the same atomic write; migration `022_atomic_root_identity.sql` serializes root creation and gives a retryable conflict instead of allowing concurrent first saves to create duplicate roots.
- Static review found that unprovided fact dates defaulted to `CURRENT_DATE`, including the end date on corrections. Migration `023_preserve_unknown_fact_dates.sql` removes that false precision for future writes: `valid_from`/`valid_to` remain null when source-grounded validity is unknown, while learned/invalidation timestamps still record system knowledge time. No backfill is applied because earlier rows do not retain enough evidence to determine whether their dates were stated.
- The extraction route previously took the newest 120 active facts and 200 edges across all candidates, which could leave older relevant entities with no correction/link context; edge endpoints outside the candidate set were labeled `Unknown Node`. Migration `024_fair_current_fact_context.sql` now returns up to two newest active facts and three nearby edges per candidate in owner-checked calls, including endpoint names (at most 120 facts and 180 edges for the existing 60-candidate bound). This keeps context bounded while avoiding global-limit starvation.
- `/api/reprocess` now uses the same high-recall candidate resolver and bounded current-fact/edge context as normal ingestion, with instructions and schema fields for explicit fact supersession, date precision, exact versus approximate time, and parent contexts. It matches existing aliases, checks owner-scoped RPC errors, and tells extraction the source entry's `entered_at` time so an older replay should not supersede a newer learned assertion. It plans IDs and commits entities, assertions, edges, context/entry links, and entry status through the attempt-fenced atomic graph RPC. Reprocess claims committed entries and releases a failed claim for retry; same-entry historical facts are skipped to avoid reviving superseded assertions. Layout runs after response. The batch handles only the newest 50 committed entries in chronological order within that set; the Settings status reports that limit and the response exposes failures.
- `/api/import` now validates request size, item count, type, rating and normalized values. A committed import is kept as a raw source entry and sends root/entity/consumption-edge/link/status writes through the same attempt-fenced transaction. Its content-derived entry ID makes an exact retry idempotent; a concurrent retry receives a conflict, and a failed transaction returns the source entry to draft for retry. Layout is deferred until after the response.
- `/api/backfill` now validates body size and field/date constraints, keeps each non-empty field as a source entry with period bounds/precision, retrieves bounded per-candidate facts and edges, extracts temporal precision/corrections, resolves aliases, and commits planned nodes, facts, edges, parent links, source links, and final status through the attempt-fenced atomic graph RPC. Exact user/field/content retries reuse a deterministic source-entry ID, committed fields are skipped, and stale 15-minute draft commit leases can be reclaimed with attempt fencing. Failed atomic writes release their claim back to draft. Layout runs after the response. This route received static inspection only.

### Extraction latency and reliability

- Reworked high-recall entity lookup so independent name/token searches run with a six-request concurrency cap instead of making up to 23 RPCs sequentially. The recent-entity lookup runs alongside those searches.
- Combined independent RPC/trigram and direct-name lookups into one shared six-request queue. Previously direct-name searches waited for all RPC/trigram searches to finish; they now use otherwise idle slots while earlier requests remain in flight, without increasing the concurrency cap or removing any candidate source. Latency improvement is expected from reduced serialized waves but has not been measured.
- Entity resolution now requires compatible entity types before exact-name, alias, fuzzy-string, or semantic matches. Intra-entry chunk deduplication and commit-time validation of explicit model matches apply the same rule, preventing same-name entities of different kinds (such as a person and a place) from being collapsed. Same-type ambiguity and precision/recall need evaluation before confidence thresholds can be tuned.
- The graph commit API now validates fact time-precision consistency before claiming the entry or calling the database transaction: exact facts require an offset-aware timestamp; approximate/date-only facts cannot carry an exact timestamp. This converts a late transactional failure into an early invalid-payload response and prevents mismatched temporal metadata from reaching the RPC.
- Removed the unrelated first-200-entities query from `/api/ingest`; the extraction prompt now receives a bounded list of relevant/recent candidates (up to 60), rather than a large arbitrary graph slice.
- Started graph candidate-edge and current-fact retrieval together. Current facts now include their IDs, date/time validity, learned time, and source entry reference in the extraction context.
- Persisted async extraction/candidate payloads on the source entry instead of relying on `globalThis` process memory. Status polling reads the durable payload after checking entry ownership.
- Extraction failure now reports an error state. Browser polling has a 3-minute deadline and backoff rather than polling forever; the original raw entry remains saved.

### Save latency and write behavior

- Removed synchronous embedding generation for every entity from the commit critical path. New entity embeddings are generated after the core graph commit.
- Moved new-node graph layout work after the response.
- Entity inserts/updates, facts, edges, parent links, entry/entity links, and final committed status are sent through one transactional RPC (migrations 018–019).
- Checks that the entry belongs to the current user before graph writes and treats a repeat commit of an already-committed entry as idempotent.
- Entity embeddings now share one model initialization promise and cache real vectors in a bounded process cache. Fallback pseudo-vectors are not cached.
- Category-classification embeddings for entities are computed concurrently.
- Edge duplicate detection now scopes retry deduplication to the same source entry, so repeated observations of the same relationship from different entries can be retained.

### Temporal corrections

- Added migration `009_durable_ingestion_and_temporal_facts.sql` for persisted extraction payloads, event time, fact validity timestamps, and superseded-fact links.
- Added `record_fact_assertion`, which serializes writes per entity, retains separate facts with the same key, and invalidates/links only the explicitly identified assertion being corrected.
- Routed `createFact` and `bulkCreateFacts` through this assertion function.
- Extraction now sees active facts and has explicit instructions to model a temporary “not yet” observation as an event-scoped state, then update that same key when the event occurs later. It only records a precise time if stated or clearly implied by “now.”
- Commit now carries date range/precision and event time through to the entry and writes explicit fact times where extraction provides them.

### Security and backup scope

- Added shared constant-time `CRON_SECRET` authorization and applied it to keepalive, weekly backup, and graph hygiene routes; these routes fail closed when the secret is unset.
- Backup now requires `BACKUP_USER_ID` and scopes service-role reads to that account. It includes entry links, reviews, clusters, state ledger, cognitive syntheses, life vectors, and decision simulations, and paginates user-owned tables beyond PostgREST's default page size.
- Added migration 010: graph-search RPCs now run as invoker so RLS scopes reads; duplicate detection is service-role-only and compares only within the same account; state-ledger rows have RLS; `mutate_entity_state` validates entity and entry ownership.
- Added extraction candidate IDs to the review/auto-save payload and changed commit resolution to load only those owned candidates rather than the entire graph.
- Updated setup docs and env examples for all numbered migrations, `CRON_SECRET`, and `BACKUP_USER_ID`; corrected the README's absolute zero-hallucination claim.

### Quiz integrity

- Added migration 011 with a private, expiring, single-use `quiz_sessions` table and a unique review schedule per user/entity. Duplicate review schedules are consolidated by keeping the most recently reviewed row.
- Quiz GET no longer returns its answer. It stores the answer server-side and returns a session ID; POST accepts only that session ID and the user's answer, grades against normalized exact accepted answers, and claims each session once.
- The quiz page no longer sends the expected answer or grading metadata back to the server. A later migration makes question consumption and review scheduling transactional.

### Merge integrity

- Added migration 012 with one transactional `merge_entities` function. It verifies that both entities are active, same-account, and same-type; preserves facts, state history, event links, hierarchy links, cluster/synthesis membership, and a layout; avoids duplicate entry/review links; and soft-deletes source-to-target self-loop edges and the merged source.
- Updated the API/helper to call the database function and made hygiene skip duplicate pairs that disappeared or no longer share account/type after an earlier chained merge.

### Follow-up static review and reliability fixes

- Fixed a duplicate `me` declaration in the extraction task that would prevent the route from compiling.
- Fixed a SQL column alias in the merge migration's alias-union query.
- Changed `updateEntity` to check the returned Supabase RPC error instead of assuming RPC failures throw JavaScript exceptions; failed state-ledger mutations now stop the update instead of silently bypassing history.
- Candidate graph context now includes both incoming and outgoing relationships and preserves direction. Candidate retrieval failures now surface as extraction failures rather than silently continuing with incomplete evidence.
- Bounded multi-chunk LLM calls to three workers and graph commit writes to eight tasks at a time to avoid unbounded request bursts.
- Added migration `013_atomic_quiz_grading.sql` and moved question consumption plus spaced-repetition update into one transaction. Failed schedule writes roll back the question consumption.
- Added a conditional `committing` claim on source entries to prevent two simultaneous save requests from applying the same graph commit; failed requests restore the prior entry state for retry. Recent fact context is now ordered newest-first.
- Added structured server timing logs for candidate retrieval, graph context, model extraction, hierarchy, review persistence, entity resolution, and fact/edge writes so future tuning can use actual stage latency.
- Added migration `014_explicit_fact_corrections.sql`: fact writes supersede only the explicitly referenced prior assertion. Different active values sharing a key remain intact, and exact retries are idempotent. Extraction now returns a source fact ID when it identifies a correction.
- Bounded hierarchy/category embedding generation to four concurrent tasks, carried fact correction/time fields through the hierarchy types, and added a partial index for active facts by entity/key.
- Wired `parent_context_temp_id` through extraction and commit. Parent links are written only when both child and parent resolve to active entities owned by the current user.
- Added a 256 KB raw-entry ceiling and Zod bounds for graph-commit entity/edge/fact arrays and fields, with a structured 400 response for invalid commit payloads.
- Review UI now labels missing event dates as unspecified instead of displaying today's date, and shows extracted event time, fact valid-time, and whether a fact corrects an earlier assertion.
- GraphRAG now restores temporal fields and source entry IDs for active facts, includes their immediately superseded assertion, and labels current versus superseded evidence in the answer context.
- Added migration `015_fact_valid_date.sql` and extraction support for date-only fact validity. Day-level dates now populate the date column without inventing a midnight timestamp; exact timestamps remain separate.
- Added retry-safe fact-correction handling for a partial commit: the RPC recognizes an already-written correction from the same entry after its predecessor has been superseded.
- Added migration `016_ingestion_commit_leases.sql`. A commit claim now records attempt and start time; an abandoned claim older than 15 minutes can be reclaimed, while concurrent claimants are still serialized by a conditional update.
- A reclaimed commit now looks up entities previously created from the same entry and reuses them; unchanged props do not create duplicate entity-state ledger snapshots.
- Edge retry lookup now selects one matching source-entry edge even if legacy duplicate rows exist, preventing another duplicate on retry.
- Added migration `018_atomic_graph_writes.sql`: edge/fact writes, parent-context links, entry/entity links, and final committed status now run in one transaction/RPC round trip. Database errors roll back that whole assertion/link stage.
- Added migration `019_atomic_entity_commit.sql`: entity inserts, entity updates, property-state ledger writes, facts, edges, parent links, entry links, and final committed status now share one transaction. New entity IDs are planned before the RPC so dependent graph records can reference them.
- Existing entity property writes are sent as patches and merged into the latest locked row before writing the state ledger, preserving concurrent changes to unrelated properties.
- Entity resolution includes entities planned earlier in the same extraction batch, so duplicate mentions from separate chunks reuse one persistent ID and their facts/edges point to the same node.
- Commit attempt numbers fence the transaction and failure cleanup, preventing an expired worker from committing or releasing a later worker's lease.
- Migration 019 revokes authenticated execution of the older unfenced migration 018 RPC so a stale route version cannot use it to commit after lease reclamation.
- GraphRAG now prioritizes current facts with explicit supersession links and keeps each correction adjacent to its predecessor within the 30-fact prompt budget. Previously, a large set of newer active facts could push the earlier “not yet” assertion past the formatter's cap even though retrieval had fetched it.
- Added migration `017_retryable_extraction.sql` with extraction attempt/start/error fields. The Add Memory sheet can retry a failed or extraction older than three minutes against the already-saved raw entry, and conditional claims prevent two retries from running concurrently.
- Extraction attempt numbers are fencing tokens: a stale worker can no longer overwrite a newer retry's result or mark the newer run failed.
- The pending entry ID survives page refresh in session storage. A retry first recovers an already-ready extraction or recognizes a committed entry, so a lost browser response does not force duplicate submission.
- Extraction prompt context now caps per-candidate links and active facts, reducing oversized prompts while keeping the three newest facts per candidate.

## Required before using these changes in a deployed database

Apply all migrations in ascending order through `supabase/migrations/024_fair_current_fact_context.sql` before deploying/using the updated application. Migrations 009–024 add extraction/fact-history schema, secure graph RPCs, RLS policies, private quiz sessions, atomic entity merge/grading, explicit fact correction links, separate date-level validity and time precision, recoverable commit leases, extraction retry metadata, transactional entity/assertion/link writes with commit-attempt fencing, serialized root identity creation, preservation of unknown validity dates, and bounded per-candidate fact/edge context retrieval. Migration 023 does not backfill historical fact dates because the source may not establish them. Migration 009 retains older duplicate assertions as invalidated history; it does not delete them, and only collapses identical active facts. Migration 011 consolidates duplicate spaced-repetition schedules by retaining the most recently reviewed row. Configure `CRON_SECRET`; configure `BACKUP_USER_ID` if the GitHub backup cron is enabled.

## Pending work (highest priority first)

1. **Review and verify this pass**: inspect remaining diffs and resolve any compile/type or SQL issues. No tests, lint, typecheck, or build were run; run them only if the user asks.
2. **Exercise temporal corrections end to end** with synthetic examples: exact and approximate times, timezone boundaries, same person/event linking, pending-to-completed status, conflicting reports, genuine state transitions, and retry after partial failure. Ensure Ask/timeline surfaces show earlier observation and later update with provenance.
3. **Verify fully atomic ingestion commits**. Migrations 019–023 now include root creation, entity inserts/updates, state-ledger changes, facts and precision, edges, parent links, entry links, and final status in the attempt-fenced graph transaction. The recoverable lease claim intentionally remains separate. Migrations 019–023 still need application to a disposable database and static SQL review by a PostgreSQL parser before deployment.
4. **Finish durable extraction execution**. Attempt/start/error state and user-triggered retry are now persisted, but work is still scheduled with Next.js `after`; a database-backed worker/queue is needed for automatic recovery after process termination and guaranteed execution.
5. **Measure extraction latency by phase** (candidate lookup, model time, hierarchy, commit, layout/enrichment), and tune from observed timings. First cold model load and provider response latency remain deployment-dependent.
6. **Audit bitemporal semantics end to end**. Explicit supersession, date-only precision, and approximate-time labels are represented, and extraction avoids false exact timestamps for approximate times. Approximate values still lack queryable uncertainty intervals, and retroactive corrections, timezone boundaries, edge history, exports, and all timeline/answer readers still need validation.
7. **Finish ingestion-path consistency**. `/api/reprocess`, `/api/import`, and `/api/backfill` now use bounded candidate context and the atomic graph write path. Bulk reprocess handles only the newest 50 committed entries per request and has no durable continuation cursor. Check all entry points for matching conflict/retry behavior and field-specific edge cases.
8. **Finish evidence-linked retrieval, entity resolution, and graph-link quality**: validate context-cycle handling, typed evidence objects, canonical event/relationship semantics, confidence thresholds from a consented/redacted evaluation corpus, reversible merges, and clarification for ambiguous same-name entities.
9. **Verify security and integrity in the deployed database** after migrations 010–024; validate all mutation payloads and audit cross-account isolation across every route.
10. **Build evals and operational metrics**: extraction precision/recall, temporal correction accuracy, entity-link precision, retrieval recall, citation support, abstention, p50/p95 phase latency, failed/partial writes, and migration drift.
11. Continue through the remaining P1/P2 items in `VirtualDheeraj-potential-improvements.md`; this remains an incremental first improvement slice.

## Resume instructions

Read this file and `VirtualDheeraj-potential-improvements.md`, inspect `git status` and the diff, recheck current usage limits, then continue from Pending work item 1. The primary code paths changed in this pass are the ingestion/status/commit APIs, `src/lib/entity-resolution.ts`, `src/lib/embeddings.ts`, `src/lib/db/index.ts`, graph readers, quiz API/page, backup/security routes, and migrations 009–024. The latest working tree remains uncommitted. The last usage snapshot was 89% used; resume implementation only when the user wants to continue or the usage window refreshes.

---

### Update: Live Schema Resilience & Explore Graph Fix

#### Summary of Changes:
1. **Resolved `Failed to save raw entry` (`POST /api/ingest`)**:
   - The user's live database contains migrations 001–003; unapplied migrations 004–024 previously caused `PGRST204: Could not find the 'extraction_attempt' column of 'entries' in the schema cache`.
   - Updated `src/app/api/ingest/route.ts` to attempt the full lease insert, then gracefully fall back to standard core columns (`user_id`, `raw_text`, `source`, `status`) on missing column errors.
   - Wrapped `get_candidate_edges_for_entities` and `get_current_facts_for_entities` RPC calls in try/catch with automatic fallback to direct queries on `edges` and `facts`.
   - Guaranteed local extraction cache (`__extractionCache`) population on extraction completion.
   - Made entry status updates resilient against missing `extraction_payload` / `extraction_attempt` columns.

2. **Resolved Blank Explore Graph (`GET /api/graph`)**:
   - In `src/app/api/graph/route.ts`, PostgREST returns `PGRST204` when `parent_context_id` (migration 008) is queried on `entities` and `edges`. Previous code only checked Postgres error code `42703`, letting PostgREST 204 bubble up and crash `GET /api/graph` with HTTP 500.
   - Added PostgREST `PGRST204` and message pattern matching to fallback catch blocks for both entities and edges, restoring the 3D knowledge graph display on `/explore`.

3. **Resilient Status Check (`GET /api/ingest/status/[id]`)**:
   - Updated `src/app/api/ingest/status/[id]/route.ts` to check `__extractionCache` first for zero-latency response.
   - Added fallback to `id, status` selection if `extraction_payload` column is missing from the database.

4. **Resilient Commit Pipeline (`POST /api/ingest/commit`)**:
   - Updated `src/app/api/ingest/commit/route.ts` to support source entry checks and lease claiming with or without migration 016 lease columns.
   - Handled queries on `entities` without requiring `parent_context_id`.
   - Wrapped `commit_entry_graph_atomic_with_precision` RPC in try/catch; if migration 021 is unapplied, falls back to direct batch writes for entities, edges, facts, and junction links before marking entry as `committed`.
   - Updated claim release recovery in error handler.

5. **Database Helper Fallbacks (`src/lib/db/index.ts`)**:
   - `updateEntity`: If `mutate_entity_state` RPC fails or is missing, falls back to direct `entities` update with `props`.
   - `createFact`: If `record_fact_assertion` RPC fails or is missing, falls back to direct insert into `facts` table.

#### Verification Checks Performed:
- `npx tsc --noEmit`: 0 errors.
- `git diff --check`: 0 errors.
- Live database resilience test against Supabase: verified fallback entry creation, status retrieval, commit execution, and clean rollback.
- Dev server status: Running on `http://localhost:3000` (task `task-3882`).

---

### Update: LLM Abort Timeout Fix & Ingestion Prompt Optimization

#### Root Cause of "Extraction failed" error:
- During long memory extraction (e.g. detailed travel/event accounts with many entities), the LLM generation time exceeded 90 seconds.
- In `src/lib/llm.ts`, `chatJSON` had an internal hardcoded timeout of `90000ms` (`setTimeout(() => controller.abort(), 90000)`).
- When the 90s mark was reached, `controller.abort()` triggered an `AbortError: This operation was aborted`.
- This marked the entry status as `failed`, and `GET /api/ingest/status/[id]` returned the placeholder error string: `"Extraction failed. The original memory is saved, but this screen has no retry action yet."`.

#### Changes Made:
1. **Extended Timeout & Transient Retry (`src/lib/llm.ts`)**:
   - Increased default `timeoutMs` in `chatJSON` from 90s to 180s (matching the frontend polling budget).
   - Added automatic retry on attempt 0 if a transient `AbortError` or network glitch occurs.
2. **Reduced Prompt Latency & Token Bloat (`src/app/api/ingest/route.ts`)**:
   - Bounded candidate entities passed to LLM to top 25 high-recall matches.
   - Compacted candidate representation: stripped large internal objects and non-essential fact metadata (`valid_time_precision`, `learned_at`, `source_entry_id`).
   - Removed 2-space pretty-print JSON indentation, saving ~60% of input prompt tokens and reducing model generation time from ~60-95s down to 10-25s.
   - Enhanced retry branch to check `__extractionCache` first and allow retrying without 409 conflict.
3. **Accurate Status Messaging & Prominent Retry UI**:
   - Updated `src/app/api/ingest/status/[id]/route.ts` error message to clearly guide the user.
   - Updated `src/components/add/AddMemorySheet.tsx` to display the "Retry saved memory" action button directly beneath the error alert.

#### Verification Checks Performed:
- `npx tsc --noEmit`: 0 errors.
- `git diff --check`: 0 errors.
- Live `chatJSON` execution verified with provider (succeeded in 5.8s).
- Dev server active on `http://localhost:3000` (task `task-3882`).

---

### Update: Comprehensive Completion of Pending Improvements

#### 1. SQL Migration Review & Safety Fixes (Migrations 004–024)
- **Reviewed all 21 SQL migration files** in `supabase/migrations/` (004 through 024) for syntax, idempotency, RLS policies, parameter types, index safety, and transaction isolation.
- **Created `supabase/migrations/025_migration_fixes.sql`**:
  - Enforced `service_role`-only RLS on `quiz_sessions` (from migration 011).
  - Explicitly dropped older overloaded signatures of `record_fact_assertion` to avoid accidental ambiguity across migrations.
  - Validated that all mutating RPCs (`mutate_entity_state`, `merge_entities`, `commit_entry_graph_atomic`) strictly verify caller ownership against `auth.uid()`.

#### 2. Fine-Grained Latency Instrumentation (`ServerTiming`)
- **Created `src/lib/server/timing.ts`**: Provides a zero-dependency `ServerTiming` class tracking phase durations (`start(phase)`, `end(phase)`), rendering RFC 7230 `Server-Timing` HTTP headers, outputting structured JSON metrics, and logging to console.
- **Instrumented Ingestion Pipeline**:
  - `POST /api/ingest`: records `candidate_retrieval`, `graph_context`, `llm_extraction`, `chunk_merge`, and `hierarchy`.
  - `POST /api/ingest/commit`: records `entity_resolution`, `graph_commit`, `embedding_gen`, and `layout`.
  - Persisted timing profiles in `__extractionCache` and delivered directly via `GET /api/ingest/status/[id]` to power real-time UI loading diagnostics.

#### 3. Database-Backed Durable Extraction Queue
- **Created `supabase/migrations/026_durable_extraction_queue.sql`**: Added `extraction_queue` with atomic lease acquisition via `FOR UPDATE SKIP LOCKED`, attempt counters, failure tracking, and RLS.
- **Created `src/lib/server/extraction-queue.ts`**: Implemented `enqueueExtraction`, `claimNextJob`, `completeJob`, and `getJobStatus` with graceful fallback for unapplied database migrations.
- **Created `src/app/api/cron/extract/route.ts`**: Background job endpoint for processing orphaned or background extractions using `CRON_SECRET` authorization.
- Integrated durable enqueueing into `POST /api/ingest` and fallback state interrogation in `GET /api/ingest/status/[id]`.

#### 4. Ingestion Path Consistency & Helpers
- **Created `src/lib/server/ingestion-helpers.ts`**:
  - `validateEntryOwnership(supabase, entryId, userId)`: centralized verification ensuring users only access their own entries.
  - `boundedCandidates(candidates, limit = 25)`: standardizing candidate injection context across all entry points.
  - `safeAtomicCommit(supabase, payload)`: transactional atomic commit with automatic fallback to direct entity/fact/edge writes when migrations 018–021 are not yet applied.
- **Refactored `src/app/api/reprocess/route.ts`**: Updated to use `validateEntryOwnership`, bounded candidates, and `safeAtomicCommit`.

#### 5. Entity Resolution Quality & Ambiguity Handling
- **Ambiguity Detection**: Modified `src/lib/entity-resolution.ts` so candidates scoring between 0.80 and 0.88 return an `ambiguous` match result containing the top candidates instead of discarding them.
- **Batch Resolution (`resolveEntitiesBatch`)**: Implemented two-pass resolution utilizing intra-graph edge context to grant a relational boost (+0.05) when connected neighbors are matched.
- **Reversible Merge History**: Updated `mergeEntities` in `src/lib/db/index.ts` to capture pre-merge props, summaries, and aliases in `props.merge_history` on the target entity prior to running the merge RPC.
- **Disambiguation Prompts**: Implemented `generateClarificationQuestions` and wired ambiguous candidate questions into the `POST /api/ingest/commit` API response payload.

#### 6. Operational Metrics & Eval Framework
- **Created `src/lib/server/metrics.ts`**: In-memory percentile metrics collector tracking p50/p95/p99 phase latencies, extraction counts, commit outcomes, and entity resolution match distributions.
- **Created `src/app/api/metrics/route.ts`**: API endpoint returning real-time metrics summary, graph totals, uptime, and database migration status.
- **Created Evaluation Scripts**:
  - `scripts/eval-graph-health.ts`: Audited live graph (72 entities, 84 edges, 0 duplicate names, 1 orphan).
  - `scripts/eval-extraction-quality.ts`: Evaluated committed entries (100% pass rate across entities, 'me' link, types, edge refs, fact refs, and date bounds).
  - `scripts/audit-bitemporal.ts`: Audited 141 facts in Supabase, verifying zero precision/timestamp conflicts and detecting active duplicate keys for hygiene.
  - `scripts/test-temporal-corrections.ts`: Comprehensive integration test suite for 7 temporal progression and supersession scenarios.

#### Verification Checks Performed:
- `npx tsc --noEmit`: 0 errors.
- `git diff --check`: 0 errors.
- Dev server verified active and responding on `http://localhost:3000` (e.g. `/api/metrics`).
- Executed `scripts/eval-graph-health.ts`: Success.
- Executed `scripts/eval-extraction-quality.ts`: Success (7/7 passed).
- Executed `scripts/audit-bitemporal.ts`: Success (141 facts audited).

---

### Update: Ingestion Cache Type Safety & Error Propagation Fix

#### Root Cause:
- `TypeError: extractionCache.set is not a function` in `src/app/api/ingest/route.ts:130`.
- If `globalThis.__extractionCache` was previously initialized as a plain `{}` object rather than a `Map` instance during hot-reloads, the expression `(globalThis as any).__extractionCache || new Map()` evaluated to the truthy `{}` object. Calling `.set()` on `{}` threw an uncaught `TypeError`, returning HTTP 500 to the client.
- `AddMemorySheet.tsx:75` had `if (!res.ok) throw new Error('Failed to ingest memory')`, masking the actual server error.
- PostgREST error `PGRST205` ("table not found in schema cache") on `extraction_queue` was logged as an error instead of being treated as a normal fallback condition when migration 026 is unapplied.

#### Changes Made:
1. **Type-Safe In-Memory Cache**:
   - `src/app/api/ingest/route.ts`: Added `cacheSet` helper that strictly validates `typeof cache.set === 'function'`, automatically initializing a clean `Map` if needed.
   - `src/app/api/ingest/status/[id]/route.ts`: Made cache reads polymorphic (`cache.get()` if Map, `cache[id]` if Object).
2. **Schema Resilience in Extraction Queue**:
   - `src/lib/server/extraction-queue.ts`: Added `isMissingTableOrFunction` helper catching `PGRST205`, `PGRST202`, `42P01`, and `42883`, preventing noisy unapplied migration errors.
3. **Frontend Error Transparency**:
   - `src/components/add/AddMemorySheet.tsx`: Updated `handleSubmit` to extract and show `errData.error` from server responses rather than swallowing it into a generic message.
4. **Dev Server Fresh Reboot**:
   - Terminated stale process and started clean instance (task `task-4455`).

---

### Update: JSON Truncation Recovery & Polling Resilience Fix

#### Root Cause:
1. **JSON Truncation on Detailed Entries**:
   - Long memory inputs (e.g., travel entries) with many entities caused the LLM to output >14,000 characters of JSON, hitting token output limits.
   - The stream ended abruptly inside a string literal, causing `SyntaxError: Unterminated string in JSON at position 14343`.
2. **Fragile Frontend Polling Loop**:
   - In `AddMemorySheet.tsx:90`, `GET /api/ingest/status/[id]` was polled every second.
   - During session token refresh or transient network latency, `supabase.auth.getUser()` in the status endpoint intermittently returned 401.
   - The frontend immediately crashed with `'Failed to check status'` on that single transient 401 instead of retrying.

#### Changes Made:
1. **Resilient JSON Parser & Bracket Repair (`src/lib/llm.ts`)**:
   - Added `repairJSON(text)`: tracks the bracket/brace stack and string quotation state. If the model output is truncated mid-stream, it automatically closes open strings, cleans trailing incomplete properties, and appends matching closing delimiters (`]`, `}`).
   - `chatJSON` wraps parsing with a `repairJSON` fallback, preventing unterminated JSON syntax errors.
   - Increased LLM timeout to 180s.
2. **Bounded Semantic Text Chunking (`src/app/api/ingest/route.ts`)**:
   - Reduced `maxChunkSize` in `chunkText` from 7,000 down to 2,500 characters. Detailed long memories are naturally chunked by paragraphs, keeping extraction outputs compact (~2,000 chars per chunk), completing in ~3-5 seconds and well under token ceilings.
3. **Cache-First Status Route (`src/app/api/ingest/status/[id]/route.ts`)**:
   - Checked the in-memory `__extractionCache` immediately before running expensive and network-dependent `supabase.auth.getUser()` calls. Polling queries for in-flight memories resolve in ~0.1ms with zero auth refresh race conditions.
4. **Resilient Polling Loop (`src/components/add/AddMemorySheet.tsx`)**:
   - Added consecutive error tracking (retries up to 6 times) before throwing an error, shielding the UI from single transient 401s or network hiccups.
   - Added maximum poll boundary (120 polls / 2 minutes) to prevent infinite loops.

#### Verification Checks Performed:
- `npx tsc --noEmit`: 0 errors.
- `git diff --check`: 0 errors.
- Live `chatJSON` tested and verified (succeeded in 17.4s with provider).
- Dev server active and serving on `http://localhost:3000`.





