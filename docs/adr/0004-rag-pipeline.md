# RAG retrieval pipeline: dense search

The per-turn retrieval pipeline runs four stages on top of the
union of context sources defined in ADR-0002. From the user's
intent to the chunks injected into the model prompt, each turn
passes through:

1. **Intent enrichment** (always on). The literal user message, the
   Project's `custom_instruction`, the thread title, and the attached
   file names are composed into a single query string. Slash tokens
   in the user message are first expanded to their resolved Skill
   bodies (ADR-0005) so the embedder sees the skill body, not the
   bare `/refactor` literal. Short or empty user messages (e.g.
   `"."`) drop the literal in favour of the intent hints so the
   embedding model sees the actual task framing instead of noise.
2. **Inline pass for small documents** (always on). Per-thread
   attachments and project sources are partitioned by size: any
   PDF whose `### Page N` count is at or below `inlineMaxPages`
   (default 2), or any non-PDF whose normalized markdown is at or
   below `singleChunkThresholdChars` (12 KB / ~3000 tokens), is
   emitted into the prompt verbatim. Bypasses vector search and
   the per-turn char budget. Larger attachments fall through to
   the RAG pipeline below.
3. **Dense vector search** (always on, runs only for the RAG-eligible
   attachments after step 2). The enriched query is embedded once
   per turn and reused across every retrieval scope. Per-scope
   `searchChunks` callbacks issue the Qdrant query restricted to
   that scope's source ids and tenancy filter.
4. **Coverage-aware selection**. The dense candidates are trimmed
   against `(maxChunks, maxChars)` budgets that scale with the
   per-turn source count. Selection guarantees one chunk per source
   before filling extras (so larger CVs each get representation),
   and a per-source cap of `⌈maxChunks / sources⌉ + 1` slots
   prevents any one source from dominating the prompt.

The inline pass and RAG path produce two non-overlapping section
sets that render back-to-back under one shared `## Source N: …`
numbering.

The inline pass uses two signals:
- **PDF page count** (`inlineMaxPages`, default 2). Counts
  `### Page N` markers in the worker output. A 2-page PDF is
  inlined regardless of byte length — at 2 pages the user almost
  always wants the whole thing in context.
- **Byte length fallback** (`singleChunkThresholdChars`, default
  12 KB) for non-PDF formats (no page markers). Format-agnostic and
  robust to whatever structure the Cloudflare worker emits per
  format. Doubles as the chunker's ingest-time "single chunk"
  threshold so one source of truth governs both decisions.

The chunker also strips the markdown worker's `## Metadata`
boilerplate at ingest and emits structure-aware chunks
(heading-anchored sections, single-chunk small documents) so the
chunks the index sees correspond to coherent semantic units.

## Removed components and why

- **HyDE** (hypothetical document embeddings) was prototyped and
  removed: with intent enrichment threading the project's custom
  instruction + thread title + filenames into the embedded query,
  the marginal recall lift from a hypothetical-answer pass did not
  justify a per-turn LLM call. The relevant signal was already in
  the embedding before HyDE ran.
- **Hybrid lexical search** (Qdrant `text` payload index +
  reciprocal rank fusion) was prototyped and removed: the keyword
  extractor was English-only (stop-word list, ASCII regex) and
  silently produced empty token sets for non-English queries. With
  a global user base, the lexical leg added no signal in those
  locales while still costing a parallel Qdrant call.
- **Cross-encoder reranking** (`cohere/rerank-v4-pro` via the AI
  SDK's `rerank` primitive) was prototyped but removed: AI SDK
  6.0.97's `rerank()` requires a `RerankingModelV3` instance, and
  neither `@ai-sdk/gateway` 3.0.66 nor any other installed
  provider exposes `rerankingModel()`. The AI SDK does not accept
  a string model id for rerank the way `embed()` does. The code
  was non-functional at runtime even with the feature flag on.
  Re-add when the AI SDK gateway adds reranker support, or by
  implementing a minimal `RerankingModelV3` shim against the
  Vercel AI Gateway's `/v1/rerank` HTTP endpoint.
- **`RAG_HYBRID_SEARCH_ENABLED`, `RAG_HYDE_*`, and
  `RAG_RERANKER_*` env vars** are consequently gone.

## Why these stages, in this order

- **Intent enrichment first** because the rest of the pipeline
  inherits its query string. Skipping enrichment means the
  embedder sees `"."` for headhunter-style turns and produces
  ~zero useful signal.
- **Inline pass before RAG**, because RAG is wasted effort on a
  document we're going to render in full anyway. The inline pass
  also removes those documents from the per-turn budget
  competition, so a 2-page CV can't be silently dropped because
  another large doc's chunks ate the budget.
- **Dense search before selection**, because selection decisions
  rely on a relevance ordering produced by the search.

## Failure modes and observability

Every external call has a per-stage timeout and a fallback:

| Stage     | Failure → returns                  | Effect              |
|-----------|------------------------------------|---------------------|
| Embedding | `null` query embedding             | Logged at error     |
| Dense     | empty candidate list               | Logged at error     |
| Selection | always succeeds                    | —                   |

When the query embedding is `null`, the per-thread and
project-source scopes use a fallback path that emits per-source
excerpts of the raw markdown (capped at the per-file budget) for
docs that didn't go inline. Org-knowledge has no fallback so it
contributes nothing on a null embedding.

In dev, `rag_partition` Effect logs emit per-attachment inline-
vs-RAG decisions plus per-scope counts. Silenced in production.

## Configuration

| Env var                       | Default | Notes                              |
|-------------------------------|---------|------------------------------------|
| `QDRANT_RETRIEVAL_TIMEOUT_MS` | `5000`  | Per Qdrant call                    |
| `EFFECT_MIN_LOG_LEVEL`        | `Warn`  | Set to `Info` locally to see partition logs |

Inline thresholds live in code (`pipeline-config.ts`), not env:
- `inlineMaxPages: 2`
- `singleChunkThresholdChars: 12_000`

## Future work

- Per-stage telemetry (`retrieval.candidate_count`,
  `retrieval.sources_represented`,
  `retrieval.dense_latency_ms`) wired into the existing
  wide-event observability pipeline.
- Pinned project sources that bypass RAG and inject in full
  regardless of size (admin-curated reference docs).
- Custom-instruction embedding cache so the project's
  `custom_instruction` is embedded once at save time and fused as
  a secondary query vector at retrieval.
- A multilingual hybrid search path that uses Qdrant's tokenizer
  on the full enriched query (not a pre-extracted keyword list)
  and falls back to dense-only when the query produces no usable
  tokens. Reintroducing keyword extraction would require a
  language-aware tokenizer that handles CJK, Cyrillic, Arabic,
  etc.; revisit when there's a concrete recall complaint
  attributable to dense-only retrieval.
- Cross-encoder reranking once the AI SDK gateway supports it,
  or via a minimal HTTP shim against the Vercel AI Gateway's
  `/v1/rerank` endpoint.
