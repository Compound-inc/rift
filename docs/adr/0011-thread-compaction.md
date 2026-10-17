# Automatic branch-aware thread compaction

## Context

Long threads previously failed at the active context limit, and the composer
blocked sending. That check counted message text but omitted the assembled
system prompt and output allowance. Standard and Max remain explicit user
choices. Compaction lets either mode continue without changing that choice.

## Decision

### Budget and cut point

Before every generation, including edits and regenerations, apply the furthest
checkpoint whose covered message is on the canonical active branch and strictly
before the latest user turn. A checkpoint never covers the turn being answered.
Message IDs are immutable across edits and regenerations, so a sibling checkpoint is ignored.
The canonical path comes from the existing branch resolver in the message loader.

Submit, edit, and regenerate prepare the exact proposed branch before writing
messages or branch selections. First validate the irreducible latest user turn,
including its library, excerpts, native attachments, system instructions, tool
schemas, and answer allowance. If that cannot fit, reject the request before any
summary call, quota reservation, or checkpoint write. Compaction then validates
the final prepared prompt before saving a checkpoint or persisting the turn.
The gateway repeats the same output-limit validation before contacting a provider.

Compact when prompt tokens, reserved output, and the larger of 1,024 framing
tokens or a 10% prompt margin reach 80% of the active window. All planners use the
shared estimator: four Latin characters per token, 1.2 tokens per CJK character,
and the common native-attachment estimates. Tool schemas count too. Reserve the
catalog output ceiling capped at 20% of the active window. The answer uses that
same total cap, with Anthropic fixed thinking reserved separately and at least
4,096 answer tokens required. Standard and Max remain explicit user choices.

Choose a cut using the actual prepared tail, including the stable document
library and current excerpts. Target about 55% of the whole window after output,
framing, and summary allowance. If the irreducible documents already exceed that
target, keep at most half the remaining history room below the trigger. If the
irreducible prompt itself exceeds the normal trigger, apply the trigger to 80%
of its remaining history room. This leaves room for subsequent turns instead of
paying for a summary every time a large unchanged library is resent.

Prefer four recent messages when they fit that target. Relax the floor to make
headroom, and summarize at least the oldest complete turn when the floor would
otherwise block every cut in a short thread. Cuts stay immediately before a user
turn. The latest user message is always retained. Sliding recovery only removes
complete turns when the prompt actually exceeds its hard budget.

Token counts remain estimates rather than provider tokenizer results.

### Incremental summaries and model policy

The summarizer receives the prior summary plus only newly aged-out conversation
text. It does not summarize retrieved document bodies. It preserves goals,
constraints, decisions, names, numbers, code identifiers, unresolved questions,
and attached file names. Attached names are also appended by the server when a
new checkpoint is created. Summaries use the thread's primary language.

Prefer Gemini 2.5 Flash Lite, GPT-4.1 Nano, then Claude Haiku 4.5, provided the
summary input fits. Every candidate goes through `ModelPolicyService`, including
organization model/provider denies, plan access, strict provider-key policy, and
BYOK resolution. An existing BYOK generation cannot switch to a platform-paid
summary route. If no suitable candidate is allowed, use the already resolved
current model. Gateway and OpenRouter ZDR options are identical to generation.
The bounded call uses AI SDK v7 `generateText` with `instructions`, a target of
2,048 summary text tokens, no retries, and a 30-second provider deadline. It uses
the lowest supported reasoning setting. Reasoning models receive up to 16,384
output tokens so thinking cannot consume the entire text allowance, subject to
the shared context/output check. Both the active stream's abort signal and
Effect's interrupt signal reach the provider. Empty summary text is a failed
summary, even when its reported provider usage must still be billed.

### Prompt layout and RAG

The summary is the final, clearly labeled, user-priority context section of the
assembled system prompt. JSON quoting prevents summary text from closing that
section. Stable Rift/mode/project instructions remain ahead of it. A checkpoint's
summary is stable until another compaction; a compaction changes the cached
prefix once, as changing the first user message would also do.

Full RAG documents remain on the first retained user message, before its existing
text. This preserves ADR-0006's library placement instead of mixing documents
into a lossy summary. Question-specific excerpts remain on the latest user
message. The loader exposes the original expanded conversation text and the
library block in server-only prepared-message metadata, letting compaction remove
the original carrier without losing the documents or summarizing them twice.

Attachment lookup happens before compaction over the complete canonical branch.
The loader queries attachments by thread and user, and supplies all canonical
attachment IDs to `RagContextService.buildTurnContext`. Files attached to compacted
turns remain eligible for full-text inclusion and retrieval. Files from an
inactive sibling remain excluded. Native image inputs age out with their turns;
file names remain in the summary, but images do not acquire a text RAG index.

### Storage and concurrency

`thread_compactions` stores immutable summaries. Its `kind` also supports legacy
sliding-window rows; new lossy fallbacks are ephemeral. The exact idempotent DDL is in
`apps/start/zero/migrations/20261016_add_thread_compactions.sql`, and is repeated
in the baseline `schema.sql`. That same unreleased migration removes orphaned
summaries and adds a unique `(thread_id, user_id)` key to `threads` plus a matching
foreign key with `ON DELETE CASCADE` only when no duplicate pairs exist. Otherwise
it raises a notice and skips the index and FK, keeping deploys working. The runner
wraps each file in a transaction, so index creation cannot use `CONCURRENTLY` and
briefly locks thread writes on its first successful run. The server-side thread
delete mutator also removes all branch summaries in its existing transaction. Optimistic clients retain
read-only access. No replicated column is dropped in this release.
The unique key is `(thread_id, user_id, covers_through_message_id)`.
The migration idempotently adds the table to an existing explicit `zero_data`
publication. Fresh-reset and drop scripts include the table as well.

Read applicable checkpoints and measure the prepared prompt without taking a
permit, transaction, or advisory lock. Only a triggered compaction takes one of
three process permits and opens a Postgres transaction. It acquires
`pg_advisory_xact_lock` for the owner and thread and re-reads checkpoints so a
concurrent winner is reused. The unique coverage key also prevents duplicates.

The triggered operation has a 45-second deadline covering permit acquisition,
the lock, policy, provider, and billing. Provider work has a 30-second deadline.
Reservation acquisition and settlement/release are uninterruptible accounting
sections; cancellation waits for their cleanup before returning. The provider
call remains interruptible. Three compactions leave pool
connections available for independent billing. Zero exposes only owner-scoped,
read-only checkpoint queries for the divider and meter.

### Billing

Each summary gets a separate `compaction:<checkpoint UUID>` request ID. Reserve
quota before the provider call, record actual usage via `recordChatUsage`, then
settle that reservation using the same user and organization. Use reported cost
when available, otherwise price actual input/output token usage from the catalog.
BYOK follows the normal quota bypass. Summary cost is never added to the answer's
analytics or reservation, and settled summary work remains charged if the answer
later fails or stops. A provider failure releases the summary reservation.
Checkpoint reuse does not invoke the provider or settle another usage event.
Billing removes the ambient checkpoint transaction connection before reserving
and settling. A checkpoint insert failure therefore cannot roll back usage for
a provider call that already completed. Settlement retries use the same request
ID and never repeat the provider call. If settlement retries fail after the
provider returned, report the accounting failure and retain the generated
summary for checkpoint persistence. A pending accounting interrupt cannot strand
the reservation between recording and settlement.

### Progress, fallback, and UI

Start the UI SSE response before the summary call. Transient `data-compaction`
parts carry `running` and `done`; a quiet progress line replaces the initial
thinking indicator while summarizing. Normal answer SSE and resumable answer
persistence retain their existing lifecycle.

The full visible history remains editable. An expandable divider immediately
after the covered message shows the summary, with a distinct label for a sliding
window. The context meter uses the prepared prompt estimate saved with the checkpoint,
including the system prompt and RAG documents, and adds newer message text.
If that prompt anchor is on an inactive sibling, it falls back to summary plus
retained message text; original historical provider totals remain available as usage
analytics. The composer allows sending at the old limit so the backend can compact.

On provider failure or deadline, retain the last applicable summary. Keep the
whole retained tail when it fits. Otherwise slide complete oldest turns only for
this request and emit an ephemeral `sliding-window` checkpoint in progress.
Never persist a provider-failure fallback, so the next request retries the same
unsummarized slice. Quota denial surfaces the normal quota error and saves
nothing. Stop or replacement before the provider returns saves no checkpoint.
If a valid paid summary exists when the request aborts, persist it in a fresh
uninterruptible transaction after the interrupted transaction rolls back, then
honor the abort. A user Stop during preparation persists the proposed user turn
or prepared edit/regeneration branch and finalizes a stopped assistant without
main-generation usage. Replacement during preparation skips turn and branch
writes so the newer request owns the branch.

A checkpoint-store failure follows the same recovery rules. If the provider
already returned usable summary text, retain that paid summary for this turn
even if the transaction, insert, or deadline fails. Log recovery through
`chat.compaction.fallback`. Transient progress is not persisted in resumable
answer SSE; a reconnect recovers the answer once its regular resumable stream
starts.

### Before deploy

Before deploy, check `select thread_id, user_id, count(*) from threads group by 1,2 having count(*) > 1`.
Resolve any duplicates to enable the optional cascading FK. The baseline retries
its guarded creation on subsequent deploys.
