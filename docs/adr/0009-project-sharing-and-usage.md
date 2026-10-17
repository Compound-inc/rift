# Org-visible projects share context, not threads

Extends ADR-0005's owner-managed Project model. Keeps ADR-0001's soft delete,
ADR-0002's source union and ADR-0003's unconditional Project Context.

## Decision

A Private Project is available only to its owner. An org-visible Project is
also available to current members of its Organization while that Organization
is active, and only while the Project's owner remains a current member of that
Organization. An active organization ID alone does not prove membership.
Anonymous users cannot read, use or manage Projects.

Members can read the Project's instructions, files, Project Skills and global
Skill overrides, and create or move their own Threads into it. Personal Skills
remain personal. Each member's Threads and messages stay private to that member;
Project visibility never grants access to another member's conversation.
Explicit Thread sharing remains a separate permission.

Management remains owner-only, including name, description, instructions,
visibility, files, Project Skills, overrides, pinning and deletion. Owners must
still belong to the Project's Organization to manage an org-visible Project.
Leaving an Organization does not change access to private Projects.
Only a current owner-member can enable org visibility. Sharing never moves a
Project between Organizations.

When an owner leaves, shared access stops immediately. The stored visibility
remains `org` so current org admins can retire the orphan. The server-side Zero
mutator `projects.resolveOrphan({ projectId, action: 'private' | 'delete' })`
verifies the caller's current admin or owner role, the active Organization and
the absence of owner membership. It allows only those two actions, never
instructions, files or skills. Other shared Projects remain owner-managed.
Organization Settings > Members includes an admin-only Orphaned projects block.
Its authenticated server projection checks current admin membership in the active
Organization and returns only project ID, name, former owner's display name and
created date. It lists only undeleted org-visible Projects without owner
membership. It never grants access to instructions, files, Skills or Threads.
Both Make private and Delete require confirmation and check both Zero mutation
phases. The authoritative mutator rechecks admin membership and orphan status.

Owners receive a small server projection of their own Organization memberships.
An orphan is read-only in settings, visibility controls, Skills and the sidebar,
with an explanation that sharing stopped when the owner left. Denied project
writes return explicit access errors so optimistic edits cannot report success
before rolling back.

Making an orphan private restores ordinary private owner management. Its owner
cannot share it again until they rejoin the original Organization. Rejoining
also makes an orphan still marked `org` shared again.

Access is checked by Zero queries and mutators and again when sending a turn.
Unsharing, removal of either the reader or owner, and soft delete hide shared
context and reject new turns by members who lose access. Past messages remain
stored, unchanged. The Project owner keeps read access and their own usage,
but cannot manage an orphan while it is still org-visible.

Member reads never sync the owner's full user row. An authenticated server
projection checks current Project access and returns only the current display
name. Email and other profile fields remain private. Full attachment rows,
including permanent URLs and storage keys, sync only to the owner. Members
receive a server projection of file metadata without download credentials or
extracted text. Revocation prevents subsequent metadata reads and RAG use.

## Usage

The Project home reports the current UTC calendar month. Members see only
usage on their own Threads. For org-visible Projects, the owner and current
org admins see an aggregate across all members only while the Project owner is
a current member. A removed owner sees only their own usage. Aggregates contain
no titles, message bodies or per-member breakdowns. Private Project usage is always owner-only.

Reporting sums persisted assistant message usage in Postgres, including archived
Threads and superseded branches because those generations incurred usage.
Missing total tokens fall back to input plus output, as in the existing chat
usage view. Missing public costs remain unknown; the UI labels partial costs.
These are reported provider costs in USD, not invoice charges or quota balances.

Usage follows a Thread's current Project membership. Moving a Thread moves its
historical reported usage too. We considered snapshotting Project attribution
per generation, but that requires a separate accounting change. This report
is a view of the Project's current Threads, not a billing ledger.

## Page composition

The Project home owns its identity header and independent sections below the
shared composer. Conversations and Project Context are separate components.
Project memory and produced documents can be added as sibling sections without
changing chat state, the composer or existing route structure. No empty sections
for those future capabilities are shown.

## Optimistic mutations and project availability

Membership checks run in the authoritative server mutation, following the org
policy mutators. Optimistic creation and moves cannot assume member rows have
synced after a cold load or org switch. Callers check both Zero result phases;
a resolved error keeps the create dialog open, shows an error and prevents
navigation or success feedback.

Conversation title search is debounced and filters the upstream query before
its limit, so older conversations can match. A completed empty project query
shows an unavailable state and a link back to chat. The composer mounts only
when the project is available.
