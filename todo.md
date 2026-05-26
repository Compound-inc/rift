# RAG retrieval quality improvements

Tracking the work to fix the multi-attachment retrieval failure mode
(see the bug report: 7 PDFs uploaded, model only saw the content of one)
and to make retrieval robust for project-scoped workflows like the
headhunter scenario described below.

> **Status legend**
> `[ ]` not started · `[~]` in progress · `[x]` shipped · `[!]` blocked

## Reference workflow — "headhunter" project

This is the canonical use case driving the design. Verify changes
against it before declaring a phase done.

```
Project: "Head Hunter for Senior Backend Engineer"
├── Custom instruction: "act as a head hunter, score by criteria X/Y/Z…"
└── Project sources (4 docs)
    ├── company-description.pdf       (always-relevant reference)
    ├── ranking-criteria.md            (always-relevant reference)
    ├── past-selections.pdf            (long-tail reference)
    └── extra-requirements.docx        (always-relevant reference)

New thread inside the project:
  attachments: [position-spec.pdf, cv-1.pdf, cv-2.pdf, cv-3.pdf, cv-4.pdf, cv-5.pdf]
  user message: "."   ← intent lives entirely in the custom instruction
```

The model needs every CV represented (round-robin), the position spec in
full, the always-relevant references in full, and ranking by the
criteria in the custom instruction. Vector similarity against `"."`
gives garbage rankings, so the system must derive intent from the
custom instruction + attached file names.

> **Future:** the "you are a headhunter" framing will move into a
> `/skill:headhunt` slash-command that injects saved prompt fragments
> into the user message at send time. Custom-instruction-based intent
> derivation should remain useful but will share the field with skill
> output. Keep this in mind when wiring intent enrichment in Phase 1E.

---

## Phase 1 — High-impact, no new dependencies

Already shipped in the original bug-fix PR:

- [x] Coverage-aware chunk selection: `selectChunksUnderBudget` does a
  per-source first pass before filling extras
  (`context-block.pipeline.ts`)
- [x] Chunker no longer emits metadata-only chunks: a small leading
  paragraph rides along with the first window of an oversized
  follow-up paragraph (`attachment-content.pipeline.ts`)
- [x] Unit tests for both
  (`attachment-content.pipeline.test.ts`,
  `context-block.pipeline.test.ts`)

Phase 1 work to ship in this PR:

- [x] **A. Strip `## Metadata` boilerplate before indexing.** `stripWorkerBoilerplate` in `attachment-content.pipeline.ts` removes the worker's `## Metadata\n- key=val\n…` block. Applied via `normalizeMarkdownForStorage` so every ingest path (file-upload-orchestrator, project-sources-admin, org-knowledge-admin) and every fallback excerpt is now metadata-free.
  - File: `lib/backend/chat/services/rag/attachment-content.pipeline.ts`
  - Tests: `attachment-content.pipeline.test.ts`

- [x] **B. Structure-aware chunking.** New `splitIntoStructureAwareChunks` splits on heading boundaries first via `splitOnHeadings`, then size-packs paragraphs within each section. Stacked navigation headings (`# title` followed immediately by `## Contents`) merge into a breadcrumb that rides with the first content section. Each emitted chunk now corresponds to a coherent semantic unit (one PDF page, one resume section).
  - File: `lib/backend/chat/services/rag/attachment-content.pipeline.ts`
  - Tests: `attachment-content.pipeline.test.ts`

- [x] **C. Adaptive retrieval limits.** `getRetrievalLimits` now takes an optional `sourceCount` and clamps `maxChunks`/`maxChars` against `perSource * count`, capped at hard upper bounds (`hardMaxRetrievalChunks`, `hardMaxRetrievalChars`). Wired through `load-thread-messages.ts` using the per-thread attachment source count.
  - Files: `lib/backend/chat/services/rag/attachment-content.pipeline.ts`, `pipeline-config.ts`

- [x] **D. Per-source fairness cap.** `selectChunksUnderBudget` now accepts `maxChunksPerSource` and refuses to add chunks that would push a single source over the cap. The `retrieveContextBlock` caller computes the cap as `⌈maxChunks / sourceCount⌉ + 1` so the multi-CV comparison case can no longer collapse into one source dominating every slot.
  - File: `lib/backend/chat/services/rag/context-block.pipeline.ts`
  - Tests: `context-block.pipeline.test.ts`

- [x] **E. Intent-enriched query.** New `IntentHints` type and `composeIntentEnrichedQuery` helper. When the literal user message is short (`< 24` chars) and hints exist, the literal is dropped in favour of `Task: <customInstruction>\nThread: <threadTitle>\nAttached files: …`. When the literal has substance, hints are appended. `load-thread-messages.ts` now reads `projects.custom_instruction` for the active project and passes the file names + thread title as hints.
  - Files: `context-block.pipeline.ts`, `load-thread-messages.ts`
  - Tests: `context-block.pipeline.test.ts`, `load-thread-messages.test.ts`

- [x] **F. Coverage-mode fallback for empty queries.** `retrieveContextBlock`'s short-circuit on empty `latestUserText` is gone. When the query embedding is `null` AND `loadFallbackContent` is provided, the function emits per-source excerpts in source order. The org-knowledge gate (no fallback) is now `queryEmbedding != null`; project-source and per-thread gates allow null embeddings because their fallback paths surface curated content regardless.
  - File: `lib/backend/chat/services/rag/context-block.pipeline.ts`
  - Tests: `context-block.pipeline.test.ts`

- [x] **G. Single-chunk small-document policy.** `splitIntoStructureAwareChunks` short-circuits when the normalized markdown is at or below `singleChunkThresholdChars` (8 KB by default). Typical resumes / one-page specs are stored as a single chunk so retrieval always returns the whole document.
  - File: `lib/backend/chat/services/rag/attachment-content.pipeline.ts`
  - Tests: `attachment-content.pipeline.test.ts`

---

## Phase 2 — Hybrid search (Qdrant + BM25)

Adds a keyword-matching path so proper-noun queries
("which CV mentions *Senior Backend* and *Kotlin*?") are not at the
mercy of dense embeddings.

- [x] **H. Add `text` payload index on `content` in Qdrant.**
  `ensureCollection` in `vector-db.ts` now registers a tantivy-backed
  `text` payload index alongside the keyword indexes (lowercase + word
  tokenizer to match `extractKeywords`). Existing collections gain
  the index lazily; index creation is best-effort so older Qdrant
  versions silently degrade to dense-only search.
  - File: `lib/backend/chat/infra/vector-db.ts`

- [x] **I. Implement parallel text-match search.**
  `searchAttachmentVectorsForScope` accepts an optional `textKeywords`
  array. When non-empty, it adds one `should` clause per keyword to
  the Qdrant filter so the query returns dense-ranked points among
  the lexically-matching subset. The four legacy `search*Vectors`
  wrappers and `VectorSearchRequest` propagate the option through.
  - File: `lib/backend/chat/infra/vector-db.ts`,
    `lib/backend/chat/infra/vector-store/types.ts`,
    the four `*-rag.service.ts` files

- [x] **J. Reciprocal rank fusion.** New utility `fuseRankings` that
  merges multiple ranked lists with `score = sum(1 / (k + rank))` and
  returns each unique item once, sorted by aggregate RRF score with
  a stable first-seen tiebreak.
  - File: `lib/backend/chat/services/rag/rank-fusion.ts`
  - Tests: `rank-fusion.test.ts`

- [x] **K. Wire fusion into the search flow.** New `runHybridSearch`
  helper in `context-block.pipeline.ts` calls `searchChunks` twice in
  parallel (with and without `textKeywords`) and fuses the result
  with RRF. The `searchChunks` callback signature changed to accept
  a `SearchChunksInput` object. `load-thread-messages.ts` now passes
  `lexicalKeywords` to all three `retrieveContextBlock` calls.
  - Files: `context-block.pipeline.ts`, `load-thread-messages.ts`

- [x] **L. Keyword extraction for the lexical query.**
  `extractKeywords` lowercases, splits on non-word characters, drops
  stop-words and short tokens, de-dupes, and caps at 12 keywords.
  Designed to match the Qdrant text index tokenizer.
  - File: `lib/backend/chat/services/rag/keyword-extraction.ts`
  - Tests: `keyword-extraction.test.ts`

---

## Phase 3 — Reranking with Cohere via the AI SDK

Largest single quality lever. Cross-encoder reranking on the top-N
candidates from hybrid search before final selection. Uses
`rerank` from the AI SDK with `cohere/rerank-v4-pro` via the AI
gateway already configured for embeddings.

- [x] **M. Reranker service shape.** New `rerankCandidates` helper
  that wraps `rerank` from the AI SDK. Feature-gated on
  `RAG_RERANKER_ENABLED=true` (default off). Returns the candidates
  re-ordered by relevance, capped at `topN`, plus a metrics object.
  Handles disabled / failed / no-candidates cases by returning the
  original list so a flaky reranker can never break the chat turn.
  - File: `lib/backend/chat/services/rag/reranker.ts`
  - Tests: `reranker.test.ts`

- [x] **N. Wire reranker into the search flow.** `retrieveContextBlock`
  takes an optional `rerankerQuery`. After hybrid fusion, `runReranker`
  is called and the result replaces the fused list before selection.
  All three `retrieveContextBlock` call sites in
  `load-thread-messages.ts` pass the same intent-enriched query string.
  - File: `lib/backend/chat/services/rag/context-block.pipeline.ts`,
    `load-thread-messages.ts`
  - Reranker model id: `cohere/rerank-v4-pro` (override with
    `RAG_RERANKER_MODEL`)

- [x] **O. HyDE for non-trivial queries.** New `buildHydePassage`
  helper drafts a hypothetical answer passage with a small/fast LLM
  and uses it for the embedding instead of the literal query. Gated
  on `RAG_HYDE_ENABLED=true` and a 24-char minimum query length;
  failures fall back to embedding the enriched query. Wired through
  `buildSharedQueryEmbedding` so all retrieval scopes benefit.
  - File: `lib/backend/chat/services/rag/hyde.ts`,
    `context-block.pipeline.ts`
  - Tests: `hyde.test.ts`

- [ ] **P. Telemetry for retrieval quality.** Emit per-turn metrics:
  `retrieval.candidate_count`, `retrieval.fused_count`,
  `retrieval.reranked_count`, `retrieval.sources_represented`,
  `retrieval.hyde_used`, `retrieval.dense_latency_ms`,
  `retrieval.lexical_latency_ms`, `retrieval.rerank_latency_ms`.
  Wire through whatever observability pipeline the chat orchestrator
  already uses (`runDetachedObserved`, wide events).

  Status: helpers return per-stage `metrics` objects already
  (`HydeMetrics`, `RerankResultMetrics`); plumbing through to the
  orchestrator's wide events is left as follow-up.

- [x] **Q. Documentation.** ADR-0004 captures the
  intent-enrichment → HyDE → hybrid → fusion → rerank → selection
  pipeline, the feature-flag matrix, and the failure-fallback
  contract per stage.
  - File: `docs/adr/0004-rag-pipeline.md`

---

## Cross-cutting follow-ups (not blocking the phases above)

These came up while designing the phased plan and should be tracked
even if they ship later:

- [ ] **Pinned project sources.** Boolean column
  `attachments.pinned_for_context` (or similar). Pinned sources bypass
  RAG and inject in full. UX and backend surface needed; flag as a
  product call.
- [ ] **Custom-instruction embedding cache.** Embed
  `projects.custom_instruction` once on save, store on the `projects`
  row, fuse at retrieval. Once `/skill:headhunt` lands the same idea
  applies to skill prompt fragments — embed each fragment's prompt at
  save time.
- [ ] **Per-document type heuristics.** Detect "small structured"
  (≤8KB) vs "large unstructured" docs at ingest and route accordingly.
  Phase 1G is the first cut; longer-term we may want explicit
  `attachment.shape = 'reference' | 'corpus' | 'snippet'`.
- [ ] **Compare-mode auto-detection.** When ≥3 attachments share a
  near-identical mime/structure, auto-tag the turn as a "comparison"
  and tighten the per-source fairness cap to 1.
- [ ] **`/skill:headhunt` (and other skill commands).** Slash-command
  framework that pulls saved prompt fragments and injects them into the
  user message at send time. Once it ships, intent enrichment (Phase
  1E) should source intent from the skill output too — keep the
  signature flexible.

---

## Phase 4 — Post-review cleanup

Driven by the thermo-nuclear quality review. All 12 findings
resolved.

- [x] **#1 Per-scope retrieval helpers.** Three retrieval blocks
  extracted from `load-thread-messages.ts` into
  `scope-retrieval.ts` as `retrieveAttachmentContextBlock`,
  `retrieveOrgKnowledgeContextBlock`,
  `retrieveProjectSourceContextBlock`. Caller drops from 843 to 554
  lines (-34%).
  - File: `lib/backend/chat/services/rag/scope-retrieval.ts`

- [x] **#2 Reranker / HyDE scaffolding dedup.** Extracted shared
  `runOptionalAiCall` helper into `optional-ai-call.ts`. `reranker.ts`
  drops from 152 to 83 lines (-45%); `hyde.ts` drops from 152 to
  92 lines (-40%).
  - File: `lib/backend/chat/services/rag/optional-ai-call.ts`
  - Tests: `optional-ai-call.test.ts`

- [x] **#3 Triple-redundant error handling in `runReranker`.**
  Removed the outer `Effect.tryPromise`/`Effect.catch` wrappers since
  `rerankByContent` cannot reject. Now reads `metrics.status` and
  reorders chunks via `orderedIndices`.

- [x] **#4 Unreachable HyDE error log.** Replaced `Effect.catchTag`
  (dead code) with a status-based check that logs when
  `hyde.metrics.status === 'failed'`. HyDE failures are now visible.

- [x] **#5 Twice-computed enriched query.** Renamed
  `buildSharedQueryEmbedding` to `buildRetrievalQuery`; it now
  returns the full `RetrievalQuery` bundle (`embedding`, `text`,
  `lexicalKeywords`) so the caller threads one value instead of
  three.

- [x] **#6 `RerankerCandidate<TPayload>` generic dropped.** New
  `rerankByContent` API takes plain string contents and returns
  `orderedIndices`; callers map back to their own payloads.

- [x] **#7 Reranker `topN` is now full-list reorder.** Removed the
  redundant `topN` parameter from `runReranker`; the helper always
  reorders the full fused list since selection follows.

- [x] **#8 Bare config numbers documented.** `pipeline-config.ts`
  knobs now have inline rationale ("3 chunks per source ≈ ~1 PDF
  page…").

- [x] **#9 `Effect.catch + log + as` pattern collapsed.** New
  `logAndContinueWith` helper wraps log-and-fallback so the four
  copies in the pipeline collapse to one-line calls.

- [x] **#10 `searchChunks` callback duplication.** New
  `buildSearchChunksCallback` helper in `scope-retrieval.ts`
  partial-applies the limit and request-extras so each scope
  config is ~10 lines instead of 30.

- [x] **#11 Dense path missing trim.** `runHybridSearch` now
  trims to `fuseTopN` even when `lexicalKeywords` is empty so the
  dense-only path matches the hybrid path.

- [x] **#12 E2E test with HyDE + rerank.** New integration test in
  `load-thread-messages.test.ts` flips both feature flags on and
  asserts: HyDE is invoked once, the rag service is called twice
  (one dense + one lexical), and the reranker mock receives the
  fused candidates.

---

## Phase 5 — HyDE and hybrid search removed

The Phase 2 hybrid search (keyword extraction + Qdrant `text` index +
reciprocal rank fusion) and Phase 3O HyDE were both prototyped and
rolled back after review:

- The keyword extractor was English-only (stop-word list, ASCII
  regex). With a global user base it silently produced empty token
  sets for non-English queries, making the lexical leg dead weight
  in those locales while still costing a parallel Qdrant call.
- HyDE's marginal recall lift was redundant given that intent
  enrichment already threads the project's custom instruction +
  filenames + thread title into the embedded query.

- [x] **Removed files:** `hyde.ts`, `hyde.test.ts`,
  `keyword-extraction.ts`, `keyword-extraction.test.ts`,
  `rank-fusion.ts`, `rank-fusion.test.ts`.
- [x] **Removed code:** `runHybridSearch` helper in
  `context-block.pipeline.ts`, the `text` payload index in
  `vector-db.ts`, the `textKeywords` parameter and `should` filter
  branch in `searchAttachmentVectorsForScope`, the `textKeywords`
  field on `VectorSearchRequest`, the HyDE call inside
  `buildRetrievalQuery`, and the `lexicalKeywords` field on
  `RetrievalQuery`.
- [x] **Removed env vars:** `RAG_HYDE_ENABLED`, `RAG_HYDE_MODEL`,
  `RAG_HYDE_TIMEOUT_MS` from `turbo.json` `globalPassThroughEnv`.
- [x] **ADR-0004 updated** to document the simplified pipeline
  (intent enrichment → dense → reranker → selection) and the
  rationale for removing HyDE and hybrid search.
- [x] **`load-thread-messages.test.ts`** Phase 3 E2E test renamed
  to `reranker end-to-end` and simplified: dense search runs once,
  reranker is invoked.

Final pipeline:
  1. Intent enrichment (custom instruction + filenames + thread title)
  2. Dense vector search
  3. Cross-encoder reranker (optional, gated)
  4. Coverage-aware selection

Multilingual hybrid search left as future work — see ADR-0004 future
work section.

---

## Phase 6 — Inline path for small attachments

Review question: "why are 2-page docs going through RAG when we
could just dump them in the prompt?" Answer: because the chunker's
8KB byte heuristic was the only signal. Replaced with a
page-count-based decision that leans on the markdown worker's
canonical `### Page N` output.

- [x] **Page count helper.** `countPdfPages(content)` counts
  `### Page N` markers at line start (worker convention). Returns 0
  for non-PDF or unrecognised content.
- [x] **`shouldInlineFullContent` helper.** PDF → page count ≤ 2;
  non-PDF → byte count ≤ 8 KB. Exposed from
  `attachment-content.pipeline.ts` and unit-tested.
- [x] **Config: `inlineMaxPages: 2`** added to `RagPipelineConfig`
  alongside the existing `singleChunkThresholdChars` (kept as the
  non-PDF fallback heuristic).
- [x] **`gatherContextSections` exported.** `retrieveContextBlock`
  refactored: section production split from formatting so callers
  can prepend pre-emptive sections (e.g. inlined small docs) and
  call `formatContextBlock` once with the combined list. Single
  shared `## Source N: …` numbering across inline + RAG sections.
- [x] **`partitionInlineAndRagSources`** in `scope-retrieval.ts`
  splits source rows into `{ inlineSections, ragRows }` based on
  `shouldInlineFullContent(content)`. Used by the per-thread and
  project-source helpers.
- [x] **Per-thread attachments helper.** Eagerly partitions; small
  attachments emit verbatim, large ones go through
  `gatherContextSections` with truncated fallback excerpts. Vector
  search runs only over the RAG-eligible subset.
- [x] **Project source helper.** Eagerly loads project source
  content (single DB call), partitions, then same flow as
  per-thread. The eager content load is justified by the
  pre-emptive partition decision — we no longer lazy-load only on
  fallback.
- [x] **Org knowledge.** Stays RAG-only. Org-knowledge content isn't
  eagerly loaded (the candidate set is the full org corpus), so
  the inline path doesn't apply.
- [x] **Tests.**
  - `attachment-content.pipeline.test.ts` adds 7 tests covering
    page-count detection, byte-count fallback, and the page-count
    boundary.
  - `load-thread-messages.test.ts` adds an integration test that
    asserts a 2-page PDF inlines without invoking
    `searchUserAttachments`.
- [x] **ADR-0004 updated.**

Deleted from the diff vs Phase 5:
- The implicit "single chunk = whole content + coverage selection"
  coupling. Small docs now bypass selection entirely.
- The `truncateFallbackExcerpt` path for small docs. Large docs
  still get the fallback when embedding fails.
- The chunker's 8 KB threshold being load-bearing for the
  inline-vs-RAG decision at retrieval (it stays as ingest-time
  optimisation only).

### Follow-up: drop page-count detection, single byte threshold

The initial implementation had two signals: PDF page count
(≤ 2 `### Page N` markers) plus a byte-count fallback for non-PDF.
Review question: "is the page count adding value?" Answer: no. All
non-image attachments flow through the same Cloudflare
`env.AI.toMarkdown` worker, but the per-format output structure
varies (PDFs use `### Page N`, docx uses `## **Section**`, others
undocumented). Anchoring on a worker-output regex was fragile to a
future worker change.

- [x] **Drop `countPdfPages` and the `inlineMaxPages` config field.**
  `shouldInlineFullContent` is now one line: `content.length <=
  singleChunkThresholdChars`.
- [x] **Bump `singleChunkThresholdChars` from 8 KB to 12 KB.**
  Generous enough that a 1–3 page PDF or a typical hiring-policy
  docx (≤3000 tokens) gets inlined in full — the user's stated
  preference ("don't miss docs context in important decisions").
- [x] **One config controls both ingest fast path and retrieval
  inline decision.** Single source of truth.
- [x] **ADR-0004 updated** to document the byte-only rule and the
  reason for dropping per-format markers.

---

## Phase 7 — Reranker discovered non-functional, removed

While fixing TypeScript errors in the build, found that the AI
SDK's `rerank()` requires a `RerankingModelV3` instance and does
NOT accept a string model id (unlike `embed()` whose
`EmbeddingModel = string | EmbeddingModelV3 | EmbeddingModelV2`).
Neither `@ai-sdk/gateway` 3.0.66 nor any other installed
`@ai-sdk/*` provider in this codebase exposes a
`rerankingModel()` method. The runtime accesses `model.doRerank()`
directly — a string would throw.

The Phase 3 reranker code was therefore non-functional whenever
`RAG_RERANKER_ENABLED=true` would have been set. Tests passed
because they mocked `rerank` itself.

- [x] **Removed:** `reranker.ts`, `reranker.test.ts`, `runReranker`
  helper in `context-block.pipeline.ts`, `RetrievalQuery.text`
  field (only the reranker consumed it), the integration test
  that exercised the reranker path, and the rerank mock from the
  load-thread-messages test setup.
- [x] **Env vars dropped from `turbo.json`:**
  `RAG_RERANKER_ENABLED`, `RAG_RERANKER_MODEL`,
  `RAG_RERANKER_TIMEOUT_MS`.
- [x] **ADR-0004 updated** with the failure mode and a future-work
  note: re-add when the AI SDK gateway exposes
  `rerankingModel()`, or via a minimal HTTP shim against the
  Vercel AI Gateway's `/v1/rerank` endpoint.

Also fixed in this batch:

- **Type errors from earlier work.** `db` parameter in
  `scope-retrieval.ts` was typed as a generic
  `{ run: <T>(query: unknown) => Promise<T> }` which TS rejected
  against the real `ZQLDatabase`. Now uses `ZeroDatabase` exported
  from `zero-database.service.ts`.
- **Stale `text` and `lexicalKeywords` fields** in test fixtures
  for `RetrievalQuery` (left over from Phase 5/Phase 7 removals).
- **Unknown error narrowing** in the project-source content
  loader's catch handler.

---

## Verification checklist for each phase

Before declaring a phase shipped, confirm:

- [ ] All new code has unit tests
- [ ] `bun run lint` clean at repo root
- [ ] `bun run test` passes in `apps/start`
- [ ] Headhunter scenario manually exercised:
  upload 4 project sources + 5 CVs in a project, send `"."`, confirm
  every CV's content is visible in the rendered prompt block (use the
  `[markdown-conversion] succeeded` log + a temporary log of the
  assembled prompt to verify)
- [ ] No leftover `[DEBUG-…]` logs (`grep` the prefix)
