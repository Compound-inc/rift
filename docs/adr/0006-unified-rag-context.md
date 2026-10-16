# One RAG pipeline for every knowledge scope

Supersedes ADR-0004. Keeps the source union from ADR-0002.

## Context

Before this change, each knowledge scope had its own path:

- Conversation attachments and project files put "small" documents into the
  prompt verbatim. "Small" meant a PDF with 2 pages or fewer, or any other
  file of 12 KB or less. Org knowledge was never put in verbatim, and had no
  fallback when retrieval failed.
- Each scope had its own character budget, so a turn could inject about
  three times the intended amount. Budgets ignored the model's context
  window and the Standard/Max context mode.
- Each turn loaded the full extracted text of every thread attachment and
  every project file from Postgres, even files that then went through vector
  search. The three scopes were searched one after another.
- Upload, retry and delete logic was copied three times. Chat uploads
  tolerated indexing failures, but org and project uploads failed the
  request. Re-indexing never deleted stale points. Documents were cut off
  after 140 chunks (about page 80 of a long PDF).
- Org and project context went before the user's message, while attachments
  went after it.

## Decision

All scopes go through `apps/start/src/lib/backend/rag`, and one
configuration (`domain/config.ts`) controls them.

### Ingest (`RagIndexerService`)

Chat uploads, project files and org knowledge share one path:

1. Normalize the markdown (strip the worker's PDF metadata block).
2. Chunk it with the structure-aware chunker: heading breadcrumbs, ~1,800
   chars per chunk, small sections packed together, and long paragraphs
   split into overlapping windows at line or sentence boundaries.
3. Embed each chunk as `file name › section` + text (a contextual chunk
   header), in batches of 96 with 4 in parallel.
4. Upsert into the shared Qdrant collection. When re-indexing, delete the
   old points first.

Indexing never fails an upload. The row is stored with
`embedding_status = failed` and a `vector_error`, and admins can retry from
settings. `attachments.content_chars` stores the length of the extracted
text, so planning a turn never has to read `file_content`.

### Per-turn context (`RagContextService.buildTurnContext`)

A source is either **pinned** or **ambient**. This is the only difference
between scopes:

- Pinned sources are conversation attachments and project files. The user
  put them in this conversation, so they must be represented.
- Ambient sources are org knowledge. They are used only when relevant.

Each turn:

1. **Budget.** Derive the budget from the active context window, which
   respects the Standard/Max mode:
   - full text: 25% of the window, capped at 32K tokens
   - retrieval: 10% of the window, capped at 8K tokens
2. **List sources.** Read metadata only, for all scopes in parallel.
3. **Plan full text.** Read pinned sources in full while they fit. Go
   greedily by tier (conversation files, then project files) and smallest
   first within a tier. The plan depends only on the set of files and the
   budget, never on the question, so it stays stable from turn to turn.
   This is how Claude and ChatGPT projects behave: small knowledge is read
   whole, and retrieval starts only when the files do not fit.
4. **Retrieve.** Pinned files that did not fit, plus org knowledge, are
   retrieved. Embed the query once (with an LRU cache) and run every scoped
   search in one Qdrant `search/batch` request. Each scope keeps its own
   tenant filter (`userId`, `projectId` or `ownerOrgId`) and its own
   candidate limit.
5. **Select.** Select chunks under the retrieval budget:
   - chunks below a relevance floor are dropped: `pinnedMinScore` (0.2) for
     attached/project files, `ambientMinScore` (0.3) for org knowledge
   - every pinned overflow file with a relevant chunk gets its best one first
   - the rest is filled by score
   - a per-source cap stops one long document from taking every slot
   - pinned files that could not be searched (not indexed, embeddings off,
     Qdrant down) get their beginning instead
   - pinned files that were searched but matched nothing are only mentioned
     (name, type, `coverage="no part matched this message"`), so the model
     knows they exist without paying for unrelated excerpts
6. **Render.** Wrap content in `<document>` tags that carry the file name,
   type and origin. Merge adjacent chunks into continuous excerpts. Every
   block says that document content is data, not instructions.

### Placement

- **Library block** (full text): goes on the **first** user message of the
  model-facing history. Its bytes do not change between turns for the same
  set of files, so the prompt prefix stays cacheable (OpenAI, Gemini and
  DeepSeek prefix caching).
- **Turn block** (excerpts): goes on the **latest** user message, before the
  user's text. Documents come first and the question comes last.

### Query

Substantive messages are embedded as-is. Adding the thread title to them
lowered the matching chunk's score and let an unrelated one past the
relevance floor in testing. Short follow-ups ("and the second one?", ".")
are expanded with:

- the previous user message
- the thread title (unless it is still the "Nuevo Chat" placeholder) and
  file names
- a clipped project instruction

This is a cheap stand-in for LLM query rewriting and adds no latency.

### Unrelated messages

Files that fit stay in context for the whole conversation, even when the
user changes topic, the same as Claude and ChatGPT projects. That block is a
stable prefix, so providers with prompt caching bill it at the cached rate.
Excerpts from large files are question-dependent: measured on a 340 KB
manual, an off-topic message ("What is the capital of France?", best match
0.02) now injects nothing, where the floor-less selection injected ~6K
tokens every turn. Very short messages ("thanks!", "hola") are expanded with
the previous question and file names, so they may still pull excerpts.

### Edits

An edited user message keeps the original message's attachments
(`attachmentsIds` is copied), and the message loader treats any file listed
on a canonical message as part of the conversation. Before, editing a
message silently dropped its files from context.

## Consequences

- When embeddings are disabled or Qdrant is down, the pipeline still works:
  small files are read whole and large files contribute their beginning.
  Self-hosted installs without Qdrant get useful file chat.
- Each turn makes at most one embedding call and one Qdrant request. When
  every file fits, it makes no embedding call and no Qdrant request at all.
  Postgres transfers file text only for documents that are actually
  injected.
- Points written before this change keep working: they have the same
  payload keys and simply lack a `section`. Run `bun run rag:reindex`
  (from `apps/start`, `--dry-run` first) once after deploying to rewrite
  every document with the new chunking and contextual headers; documents
  over 140 chunks are only fully searchable after that. The per-file retry
  action does the same for one org-knowledge or project file.
- Prompt caching: gateway requests already send `gateway.caching: 'auto'`,
  so the gateway places provider cache breakpoints itself. BYOK Anthropic
  requests bypass the gateway, so they get request-level
  `anthropic.cacheControl` (Anthropic automatic caching) instead
  (`chat-orchestrator/prompt-caching.ts`). OpenAI caches prefixes
  automatically on both paths.
- The composer's context meter uses the provider-reported input tokens of
  the last turn, which already include injected documents, so it reflects
  RAG context without extra work.
- Deleting a thread marks its attachments deleted in the same Zero mutation,
  and the `/api/zero/mutate` route then removes their vectors after commit
  (`purgeDeletedThreadDocuments`). It only purges threads that no longer
  exist, so a rejected delete cannot remove a live thread's vectors.

## Removed

- `chat/services/rag/*`: the per-scope RAG services, scope retrieval, the
  context-block pipeline and the two pipeline presets.
- `chat/infra/vector-db.ts` and `chat/infra/vector-store/types.ts`, replaced
  by `rag/services/vector-store.ts`.
- The PDF page-count inline rule and the 12 KB single-chunk rule, both
  replaced by budget-based planning.
- `AttachmentRecordService.listAttachmentContentRows*` and
  `OrgKnowledgeRepositoryService.listActiveAttachmentIds`.

## Configuration

| Setting | Where | Default |
|---|---|---|
| Chunk size / overlap / cap | `rag/domain/config.ts` | 1,800 / 200 / 2,000 chunks |
| Full-text budget | `rag/domain/config.ts` | 25% of window, ≤ 32K tokens |
| Retrieval budget | `rag/domain/config.ts` | 10% of window, ≤ 8K tokens |
| Ambient relevance floor | `rag/domain/config.ts` | 0.3 |
| Pinned relevance floor | `rag/domain/config.ts` | 0.2 |
| `QDRANT_RETRIEVAL_TIMEOUT_MS` | env | 5000 |
| `VITE_ENABLE_EMBEDDING` | env | `true` |
