# Rift

Rift is a chat product for talking to AI models, with multi-tenant
organizations, BYOK keys, and per-thread RAG.

## Language

**Project**:
A user-owned container that groups Threads and applies a shared custom
instruction plus attached files (via RAG) to every Thread inside it.
_Avoid_: Workspace, Folder, Collection.

**Thread**:
A single linear conversation, persisted as `threads`. Optionally belongs
to one Project.
_Avoid_: Conversation (in code), Chat (as a noun).

**Project Context**:
The combination of a Project's `custom_instruction` (system-prompt text)
and Project files (RAG corpus) automatically applied to every Thread in
the Project.
_Avoid_: Project settings (which is broader — also includes name,
description, visibility).

**Project Files**:
Files (e.g. PDFs) attached to a Project, chunked and embedded into the
shared vector store, retrieved per-turn for any Thread in the Project.
_Avoid_: Knowledge base (reserved for org-wide knowledge), Documents.

**Custom Instruction**:
The text injected into the system prompt for a Thread or Project. Stored
inline as `projects.custom_instruction`. Per-Thread custom instructions
are not yet a real feature (see ADR-0003); the dangling
`threads.custom_instruction_id` column is unused.
_Avoid_: System prompt (reserved for the assembled, full system message).

**Organization**:
The multi-tenant auth/billing boundary backed by Better Auth. Owns
subscriptions, member access, BYOK keys, AI policy, and org-wide
knowledge.
_Avoid_: Workspace (in code) — see Flagged ambiguities.

**Org Knowledge**:
Org-wide admin-curated RAG corpus, distinct from a Project's files.
_Avoid_: Knowledge base (in user-facing copy when ambiguous).

## Relationships

- A **Project** belongs to exactly one user (`user_id`) and optionally
  one **Organization** (`organization_id`); `visibility` controls whether
  org members other than the owner can see it.
- A **Thread** belongs to at most one **Project** (movable in either
  direction).
- A **Project** has many **Project Files** (via `attachments.project_id`).
- A Thread inside a Project receives that Project's **Project Context**
  unconditionally (ADR-0003).
- RAG retrieval for a Thread inside a Project unions per-message,
  per-thread, project, and org-knowledge sources (ADR-0002).
- Project deletion is a soft delete with a Windows-folder cascade: the
  project, its Threads, and its Project Files are hidden together. FKs
  are preserved on the soft-deleted side (ADR-0001).

## Example dialogue

> **Dev:** "If a user moves a **Thread** out of a **Project**, do past
> turns lose their **Project Context**?"
>
> **Domain expert:** "No — past turns are immutable. The Thread's old
> messages were already generated with the Project's instructions and
> retrievals; we're not rewriting history. Only future turns stop seeing
> the Project's context."
>
> **Dev:** "And if I delete the **Project** the Thread is in?"
>
> **Domain expert:** "Soft delete with a Windows-folder cascade. The
> project disappears, and so do its threads and attached files — they
> all become invisible together. Database rows survive intact (the FK is
> preserved), so a future restore feature can bring everything back, but
> the user can no longer see the threads anywhere in the UI."

## Flagged ambiguities

- **"Workspace"** has been used to mean both **Organization** (in
  pricing/billing copy) and an unbuilt entity (the dangling
  `attachments.access_scope = 'workspace'` enum value and `workspace_id`
  column). Resolution: do not use "Workspace" as a domain term in new
  code. Use **Organization** for the multi-tenant boundary and
  **Project** for the new Thread-grouping concept. The dangling
  `attachments` columns will be repurposed to mean Project as part of
  the Projects feature.
- **"Custom instruction"** vs **"system prompt"**: a custom instruction
  is the user-authored text that contributes to the assembled system
  prompt, alongside model-mode prompts and tool descriptions. They are
  not interchangeable.
