# Documents live beside their originating Thread

## Ownership and storage

Documents are private markdown or code deliverables owned by their originating
user, Thread and organization. They copy the Thread's Project at creation;
moving the Thread does not move its Documents. Reads and writes check the user,
Thread, organization and active Project in one transaction. Tenant identifiers
come only from AI SDK v7 `toolsContext`, never model inputs.

`documents` stores metadata and the current version pointer. Immutable
`document_versions` store bodies and assistant/user attribution. Appending a
version and advancing the pointer is atomic. Bodies have a 204,800 UTF-8 byte
storage limit; titles have a 200-character limit. Message rows use the shared
bounded `messages.parts` tool records for document references and tool states.
Inputs and outputs retain metadata and structured errors, never bodies. No separate
`messages.document_refs` column is introduced. Create ids derive from message/tool
call ids so retried creates are idempotent. Migrations are idempotent.

Anonymous account linking transfers Documents with Threads, preserving any
existing organization and filling a missing organization from the target
account. Permanent Thread deletion hard-deletes Documents and their versions.
Version rows also have a cascading foreign key to the Document. Server Thread
deletion uses SQL and this cascade so it never loads version bodies; optimistic
client deletion removes the locally cached versions explicitly.

## Model tools

`create_document` writes a deliverable; `read_document` fetches its latest version
including user edits; `update_document` replaces the full body. Updates require
`baseVersion` from a read or create. A stale base returns `version_conflict` with
the current version, and the model must read again before retrying. Expected
domain failures return `{ ok: false, error: { code, message } }`; successful
results include `ok: true` and document metadata. Tool failures show a quiet card
state. Invalid SDK input still belongs to the orchestrator's stream formatting
boundary.

The gateway plans output and document results together in v7 `prepareStep`,
using the accumulated prompt, including replayed tool inputs and results. After
prompt framing and fixed thinking, a minimum following answer is reserved.
Generation retains the full catalog/context output limit while document tools
are available. A separate replacement allowance gets 30% of the working context,
with a 4,096-token minimum and a 32,768-token ceiling, bounded by the resolved
output limit. Document results get 70% of the remaining context. This potential
read allowance does not reduce ordinary answer output. Actual tool results enter
the following prompt, where output is resolved again. Fixed thinking is deducted
once per request. The resolved output and shared mutable result allowance travel
through v7 `toolsContext`. Sequential reads spend that allowance; each read keeps
a share for later calls in the step. Create/update summaries spend the same
allowance. The next step replans from its actual messages rather than resetting
to the original prompt's budget.

Full replacements reserve 70% of the replacement allowance for the serialized
update input. Read/create/update results report `rewritable` and
`maxRewriteTokens` so the model can avoid streaming an ineligible replacement.
The advertised limit also accounts for the projected following prompt, including
the result itself. Per-turn maps retain that limit for the exact document version.
Updates check that promise without requiring another full read to fit the current
result allowance. A following request starts only when its output can honor
outstanding advertised limits. Both checks use the shared Unicode token
estimator, including JSON escaping and metadata. Truncated reads include a marker
and the full body's byte count; a truncated base cannot be rewritten later in the turn without a complete reread.
The 200 KB storage limit remains independent, so users can edit larger Documents
directly or request proposed changes in chat. Targeted model edits are deferred.

The `rift.documents` catalog key controls all three tools and their system
prompt. `assembleSystemPrompt` places the stable document guidance immediately
after mode instructions and before user/project/memory/turn context. Model
capabilities and org/Thread policy still apply. Legacy Gemini 1/2
models discard function tools when native tools are present. For those
requests we preserve native tools such as search and omit document tools and
their prompt. Gemini 3 and newer models can combine them.

## Loop and accounting

The tool loop uses `isStepCount(4)` and `toolCallConcurrency: 1`. After each
completed tool step, a context stop condition checks the accumulated response
before starting another provider request. Exhausted context ends the turn
successfully with the saved document card and completed-step usage. Step
preparation also handles exhausted context without throwing. Historical tool
parts become small document references before model-message conversion. Their
versions stay frozen at the version that each call produced. A bounded block of
current versions appears only at the end of the latest turn so document saves
preserve the historical prompt prefix. Document references reserve bytes and
slots before other tool display parts, preserving their cards across reloads. The
ordered renderer selects a document card for each document tool part before
the generic activity renderer. Text
from separate steps stays ordered. The model can read, revise and summarize
within one turn; longer work may require another turn.

Normal completion uses v7 aggregate usage once. Gateway cost and search counts
sum across steps. OpenRouter chooses upstream inference cost or credits per step
before summing, including zero upstream cost. Provider token metadata is
aggregated only for the existing missing-usage fallback.

On Stop or failure, v7 can reject aggregate usage and steps. The orchestrator
captures each completed step's usage and provider metadata in `onStepEnd`.
Settlement preserves those actuals and estimates only an unfinished step that
emitted provider output, using its current prompt and streamed output. An
unstarted or silent unfinished step adds no estimate. Without any reported usage,
cost or streamed text/reasoning/tool output the reservation is released. `onError`
only formats tool and transport errors; `onEnd` owns persistence and exactly-once
settlement. Expected document failures remain structured tool results and allow
the model to recover in the same loop.

## Panel and editing

The right panel loads one selected version at a time. Edit is available only for
the latest version; Restore appends an older body as a new user version. User
saves carry an expected version and preserve the draft after a conflict. Markdown
and code use the existing safe renderers. Export uses sanitized filenames and
CSS-based printing. Ask Rift adds a bounded, quoted selection with id/version to
the composer. Rich editing, HTML execution and live collaboration are deferred.
