# Personal instructions and long-term memory

## Decision

Custom instructions belong to a user across workspaces. Memory belongs to one
user within one organization and requires current membership. Instructions use
two fields limited to 1,500 characters each. Project instructions remain
unconditional, as required by ADR-0003.

Use Supermemory for profile extraction and semantic recall. Considered building
extraction, retrieval and deletion on Rift's RAG storage. Rejected because RAG
indexes documents; conversational memory also needs to consolidate facts and
maintain user profiles. Considered model-callable memory tools. Rejected because
recall and saving should follow consent policy on every turn without relying on
the model to invoke them.

Call the SDK explicitly through Effect services. Considered `withSupermemory`
middleware. Rejected because implicitly saving model-facing messages would send
attachments, expanded skills, RAG context, tool results and reasoning to the
memory vendor. Save only successful, non-stopped, non-empty turns. For turns
that use any attachment, retrieved conversation/project files, organization
knowledge, or any tool, send only the raw user message. Other turns send the
raw user message and final assistant text. The message loader reports actual
attachment/RAG context use and the orchestrator records tool/source events,
then passes an explicit `userTextOnly` flag to `rememberTurn`. Never send
model-facing history, tool payloads, reasoning or expanded prompt blocks.
Edit and regenerate use the canonical raw user anchor before prompt expansion.

Accepted limitation: a later plain turn such as "repeat that" can restate private
RAG or tool content from an earlier answer and save that restatement. The current
`userTextOnly` check covers context used on the current turn, including attachments
and RAG material expanded from history. It does not persist provenance on assistant
messages or inspect prior plain assistant text for its origin. A recent-message
provenance flag would reduce this gap but would not eliminate indirect restatements;
we defer that schema change. Raw user text may itself include sensitive content.

## Scope and consent

Every vendor operation uses the same complete hashed namespace:
`rift:org:<16 hex SHA-256 characters>:user:<64 hex SHA-256 characters>`.
The org digest hashes the organization ID; the user digest hashes the JSON tuple
`[organizationId, userId, generation]`. This avoids tuple delimiter collisions
and keeps the namespace under the vendor's length limit. Considered user-only
and shared org namespaces. Rejected because they would mix workspace context or
expose personal memory to other members.

Reserve `rift:org:<org digest>:project:<project digest>` for future project
memory. It will need separate membership and sharing checks.

Existing users opt in, including when they later join a workspace. New users
default on only when deployment and organization policy allow it. Missing vendor
configuration, missing membership, user opt-out or organization policy disables
recall and saving. ZDR excludes memory, including BYOK requests. Turning memory
off preserves existing data; listing and deletion remain available.

Capture the namespace generation at recall and re-check consent, membership and
generation inside bounded detached saving. At most eight saves run per process;
saturated saves are dropped with a content-free log event. There is no alternate
detached ingestion entry point without those checks.

Settings actions include the organization displayed in the tab. The server
rejects it if it differs from the session's active organization, then derives
user identity and checks current membership on the server.

## Durable purge lifecycle

`memory_namespaces` records the complete vendor namespace, user, organization,
generation and purge state immediately before the first save, and when reset
rotates a generation. Preference loading and recall are read-only; disabled users
do not create ledger rows per turn. The ledger has no cascading auth foreign keys.
Registration locks membership and preference rows; a shared per-scope transaction advisory lock
serializes first use and reset. A namespace outside `active` cannot accept saves.
`memory_documents` records each `turn:<assistantMessageId>` and its thread before
ingestion. Both tables retain attempts, next retry, successful passes, sanitized
last error and completion timestamps. User/org/status/due/thread indexes support
cleanup without current membership. The feature has never shipped, so there are
no vendor saves to backfill. We do not create namespace/document rows for existing
messages or per-member preference rows. The account-level default backfill keeps
existing users opted out, including in future workspaces.

On completion, clear namespace `user_id`, `organization_id`, `generation` and
document `thread_id`. Keep the hashed vendor namespace, document target and purge
metadata as tombstones, so a stale registration cannot reactivate a purged target.
The ledger never stores conversation text.

Database triggers on organization deletion, user deletion and member removal
mark the affected namespaces `purge_pending` in the deletion transaction.
This also covers direct SQL and cascading deletes. Member removal disables
consent and rotates the preference generation, so rejoining cannot restore the
old namespace. Removed members' workspace memories are purged automatically.
Better Auth post-delete hooks start best-effort processing after commit.

Delete-all disables consent, rotates the generation and queues all prior scope
namespaces in one transaction, including when the API key is missing. The UI
reports queued deletion. It does not wait for a vendor call. Pending targets
wait 30 seconds, beyond the 10-second detached-save and 8-second HTTP deadlines.
The worker performs a first purge, waits at least another 30 seconds, then
performs a second purge as a delayed recheck. Only the second successful pass
marks a target `purged`. Failures retain targets with exponential backoff from
60 seconds to one day. A missing API key leaves targets and attempts unchanged.
Restore access to the same vendor account/key scope to finish those purges.

The server entry starts a scoped in-process worker only with
`SUPERMEMORY_API_KEY`. It runs every 60 seconds, acquires a 90-second Redis lease
with `SET NX PX`, then drains batches of at most 16 namespace and 16 document
targets, four concurrently per table, yielding between batches until nothing is
due. Each tick has a 45-second drain budget; excess work resumes on later ticks.
Lease release compares the random owner token atomically before deleting the key.
Only one server instance drains cluster-wide. Without configured/enabled Redis,
the lease is process-local; SQL row locks still coordinate separate processes.
Redis outages skip work and log a content-free failure, then retry next tick.

Workers use `FOR UPDATE SKIP LOCKED` and hold each row lock through the bounded
HTTP call. A crash rolls back progress. Later ticks perform delayed second passes
and retries without an external cron. The worker never runs on a request fiber,
and its scope interrupts timers and in-flight work and closes Redis on shutdown
or development reload. Tests and scripts do not start it by importing a runtime.
Auth/Zero hooks remain a best-effort latency optimization.

`bun run memory:purge` from `apps/start` remains available for manual/self-hosted
runs with `ZERO_UPSTREAM_DB` and `SUPERMEMORY_API_KEY`. It drains due batches and
exits; a second invocation after 30 seconds completes delayed rechecks when no
app server is running. Monitor old pending rows/errors.

Permanent thread deletion queues its saved source exchanges in the same
transaction through triggers on `threads` and `messages`, covering the Zero
thread mutator and direct SQL. A successful Zero delete also starts best-effort
processing. Registration locks the thread first and then its persisted message,
matching the parent-before-child deletion lock order, so a late response cannot register a new document after deletion. Source documents
are deleted through the namespace-scoped vendor document API, which also removes
their derived knowledge. These targets use the same drain, recheck and retry
lifecycle as namespace purges.

Individual memory deletion first resolves its source document through the
namespace-scoped SDK, queues that document durably when available, then forgets
the fact. The settings copy states that source deletion is queued when available;
otherwise the source conversation is deleted when its chat is permanently
deleted. A forget alone still preserves vendor audit history until the source
or namespace is purged. Documents cannot be reconstructed for users/orgs/chats
already removed before the ledger rollout.

## Prompt integration

Assemble base/mode instructions, custom instructions, project instructions and
memory, in that order. Delimit user preferences and remembered facts as data;
neutralize only those delimiter tags so legitimate code and operators survive.
Personal preferences are subordinate to system and project rules. Memory may be
stale and has no instruction authority over the current request.

Expose separate `customInstructionsSection` and `memorySection` strings to
`assembleSystemPrompt` through its `customInstructions` and `memory` inputs.
The assembler owns the outer delimiters and their escaping. Personalization owns
only its inner preference fields and memory facts, so neither layer escapes the
other's delimiters twice.

Start recall from the raw user anchor during the read-only history preview, before
skill expansion and RAG. Its 800 ms budget includes preference reads; completed
instructions survive a recall timeout. Consent reads and retrieval run in child
fibers. Join the resolved sections before the pre-persistence prompt check, so
submit, edit and regenerate all reject exhausted context before writing messages
or changing branches. Persistence methods have no hidden memory-saving effects.

Limit each custom field to 1,500 input characters and each of at most 18 recalled
facts to 1,200 input characters. Use the shared token estimator on the serialized
sections, including wrappers, escaped delimiters and separators. This accounts for
CJK text consistently with the context check, quota and RAG planner. Reserve only
sections actually resolved for this turn; empty, disabled, failed and timed-out
recall adds no memory tokens. The pre-persistence check and quota estimate include
this allowance alongside the base/mode/project prompt and tool schemas.

Learn only after successful assistant persistence, on successful, non-stopped
turns with non-empty raw user and assistant text. A stopped response has status
`cancelled`, even when partial output is retained. Billing still settles any
provider work independently of stop status or persistence success. Attachment/RAG
context, tool activity in the current stream, and persisted tool parts in the
selected history all require saving only the user's raw text.
