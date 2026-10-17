# Chat UX roadmap

The goal list for bringing Rift's chat experience up to date with current AI
chat apps. Each workstream gets its own branch and worktree off `origin/main` (or is
stacked on the branch it depends on). A GPT-6.1-Sol subagent builds it. It is
then reviewed, committed, and opened as a PR. Merging to `main` deploys to
production.

> **Status legend**
> `[ ]` not started · `[~]` in progress · `[r]` in review · `[x]` merged · `[-]` dropped

Rift is a general AI chat app for teams. PR #63 replaces the old HR framing in
`PRODUCT.md` and `DESIGN.md`.

## Wave 0: foundation

### WS0: AI SDK v7 (`feat/ai-sdk-v7`, PR #55)

- [x] Upgrade `ai` 6.0 → 7.0, `@ai-sdk/react` 3 → 4, providers to latest,
  `@openrouter/ai-sdk-provider` 2 → 3. Remove the unused `@ai-sdk/mistral`,
  `@ai-sdk/moonshotai`, and `tokenlens`.
- [x] Keep billing and analytics exact. v7 renames the usage fields and moves
  `providerMetadata` to `result.finalStep`.
- [x] Evaluate v7's provider-agnostic `reasoning` option against the
  per-provider reasoning mapping.
- Why now: WS2 rewrites the same stream code that v7 renames, so it goes on
  top of this upgrade. Later work also gets `toolsContext` (documents and
  memory tools), correct multi-step usage totals (needed by the documents
  tool loop), and tool and chunk timeouts. v7 doesn't change stop handling
  for resumable streams: a dedicated stop endpoint is still needed, which is
  what WS1 builds.

## Wave 1: fix what's broken (parallel)

### WS1: Stream control (`feat/stream-control`, PR #57, stacked on #55)

- [x] **Stop button.** It's disabled while streaming and nothing calls
  `stop()`. Stop has to abort the server-side generation too, since resumable
  streams keep generating after the client disconnects. The partial answer is
  kept as a stopped message, not shown as a failure.
- [x] **Retry.** Failed assistant messages get a Retry action that re-runs the
  same turn.
- [x] **Queued messages.** You can type and send while a response is
  streaming. The message is queued, can be edited or removed, and is sent
  when the current response finishes.
- [x] **Fix: failed answers show the error and Retry twice** (inline and in
  the composer banner). Found by the screenshot run; fixed in PR #57.

### WS2: Generation output (`feat/generation-output`, PR #59, stacked on #57)

- [x] **Tool activity is visible.** Web search and code execution calls render
  live (`tool-call-part.tsx` exists but nothing renders it).
- [x] **Sources reach the client.** Set `sendSources` and render a sources list.
- [x] **Tool calls and sources are persisted** and survive reload.
- [x] **Per-model output limits.** Replace the hardcoded 8K/12K
  `maxOutputTokens` with catalog limits, and offer "Continue" when a response
  ends on `finishReason: 'length'`.
- [x] **Better default system prompt**: date, formatting and citation
  guidance, language matching.
- [x] **Fix analytics persistence**: `provider_metadata` and
  `generation_metadata` are always null.

### WS3: Sharing and archive (`feat/share-archive`, PR #56)

- [x] **Share links.** Create, copy, and revoke links. Links can be org-only
  or public, and can show or hide the sharer's name. A read-only shared view
  is served at `/share/$shareId`. The schema columns already exist.
- [x] **Archive.** Archive and unarchive threads, with a view listing
  archived threads. The mutator and column already exist.
- [x] **Fix: "Continue this chat" on a shared page always fails.** The fork
  inserts messages with `branchIndex: 0`, which violates
  `messages_branch_index_positive`, and the real error was swallowed into
  "Sharing unavailable". Found by the screenshot run; fixed in PR #56
  (`cec11d37`) with a Postgres-backed regression test.

## Wave 2: keep conversations going (after WS2 merges)

### WS4: Long-thread compaction (`feat/compaction`, PR #61, stacked on #59)

- [x] When a thread nears the context window, summarize older turns into a
  stored checkpoint and send summary + recent turns, instead of failing with
  "switch to Max".
- [x] Show a quiet "earlier messages summarized" marker in the thread.

### WS5: Personalization: memory + custom instructions (`feat/personalization`, PR #60, stacked on #59)

- [x] **Memory via Supermemory.** Save and recall facts per user, scoped by
  container tag. Users get a settings page to view and delete memories and to
  turn memory off. Admins get an org policy toggle, and memory follows the ZDR
  rules. Needs `SUPERMEMORY_API_KEY`.
- [x] **Per-user custom instructions** ("about you" / "how to respond"),
  applied to every chat.
- [x] **Fix: no Save button on custom instructions.** The shared form
  ignored `forceActions` when deciding whether to render its footer. Fixed
  in PR #60.
- [x] **Fix: org "Allow memory" policy never loads.** The status request
  omitted the organization id, so the workspace check rejected it. Fixed in
  PR #60.

## Wave 3: documents (after WS2)

### WS6: Documents (`feat/documents`, PR #62, stacked on #59)

- [x] Add a multi-step tool loop (`stopWhen`) to the stream call.
- [x] Add `create_document` / `update_document` tools. Documents open in the
  right sidebar, are versioned, can be edited by the user, and can be
  exported.

## Wave 4: projects as workspaces

### WS7a: Project workspace foundation (`feat/project-workspace`, PR #58)

- [x] Project home: the composer first, then conversations, instructions,
  files, and skills.
- [x] Visibility control (private / org), with the access rules enforced end
  to end and an ADR.
- [x] Token usage per project.
- [x] **Fix: orphaned-project admin section never renders.** No server code
  set `activeOrganizationRole` on the session; the role now comes from Better
  Auth's active-member query. This also fixes admin-only UI in skills,
  billing and pricing, which was broken on `main`. Fixed in PR #58.
- [x] **Fix: "Project unavailable" state was unreachable.** The project layout
  now shows one shared unavailable view for every project page. Fixed in
  PR #58.
- [x] Polish: the visibility picker uses the design-system select (PR #58).

### WS7b: Project memory + documents (unblocked: #58, #60 and #62 are merged)

- [ ] Project memory: a Supermemory container per project.
- [ ] Documents produced in the project, shown on the project home.

## Integration order

PRs #55–#63 were merged together on 2026-10-17. They were combined on one
integration branch, verified there (typecheck, lint, the full Vitest suite
against Postgres, and the Zero migrations from the previous `main` schema),
and fast-forwarded into `main` as one deploy. Fixes that only existed after
combining the branches are in the integration commits:

- the shared page's image blocking (#56) moved to the renderer #59
  introduced;
- thread deletion removes documents (#62) and compaction checkpoints (#61)
  in one mutation, and its tests cover both;
- answers whose stream ends in an error are stored as failed again (#62).

After deploying: run `bun run rag:reindex` from `apps/start` (`--dry-run`
first, see ADR-0006), and set `SUPERMEMORY_API_KEY` to enable memory.

ADRs: 0007 share/archive, 0008 personalization, 0009 project sharing,
0010 documents, 0011 compaction.

Two-phase follow-up: a later release drops `messages.provider_metadata`,
`generation_metadata` and `ai_cost`, at least 24h after #59 deploys. That
release must first repeat the copy-then-clear, because old servers can still
write `ai_cost` during the rollout. Also confirm that the production Zero
publication lists tables explicitly, so `message_analytics` isn't
replicated.

## Chores

- [-] Link the PWA manifest. It was already linked (`buildRootLinks` in
  `lib/frontend/metadata/metadata.functions.ts`); the earlier analysis was wrong.
- [x] Rewrite `PRODUCT.md` users/purpose, and the HR wording in `DESIGN.md` /
  `design.json` (PR #63).

## Out of scope (decided)

Feedback thumbs, HR-specific features (comparison view, bulk screening, role
templates), MCP connectors, voice, and changing the welcome suggestions.
