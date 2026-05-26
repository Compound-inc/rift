# Skills feature: scope, persistence, and resolution

A **Skill** (see CONTEXT.md) is a named, user-authored markdown fragment a
user opts into for a single turn by typing `/[skillname]` in the composer.
Skills exist alongside — not instead of — **Custom Instruction**: Custom
Instruction is the always-on, project-wide system prompt; a Skill is opt-in
per turn and lives in the user message.

This ADR captures the decisions that are hard to reverse later.

## Three scopes, one table

A Skill has one of three scopes, encoded as nullable scope columns on a
single `skills` table:

| Scope             | `project_id` | `organization_id` | `user_id`           |
| ----------------- | ------------ | ----------------- | ------------------- |
| Project Skill     | set          | nullable          | creator (audit)     |
| Personal Skill    | null         | null              | owner               |
| Org-Shared Skill  | null         | set               | owner / creator     |

A Personal Skill becomes Org-Shared by setting `organization_id`. Unsharing
clears it. There is no separate row, no copy, no promotion — sharing is a
permission flag, not a lifecycle change.

We considered keeping Org-Shared as a separate table parallel to Org
Knowledge. Rejected because the two are different concepts: Org Knowledge
is admin-curated organization-wide content; Org-Shared Skills are
*personal* skills a user has chosen to share. Conflating them would force
admin-only edit semantics on a feature that is fundamentally member-owned.

## Edit permissions follow the project model

Project Skills are editable only by the project owner, mirroring how every
other project resource (`custom_instruction`, project files, name) behaves
today. This is intentionally consistent with `checkProjectAccess`.

When the planned project-wide collaboration toggle ships, Skills get
unlocked along with `custom_instruction` and Project Files in one
predicate change. Skills do not lead the way on collaboration.

Org-Shared Skills are editable by their creator only by default. The
creator may opt org admins into co-edit by flipping a per-skill
`allow_admin_edit` toggle — this is the one place where the schema deviates
from "owner only," and it is opt-in by the owner, not granted by the org.

## Resolution chain

For a `/refactor` token authored by user U in thread T inside project P
(of org O):

1. `skills` where `project_id = P AND name = 'refactor'` → expand if
   present.
2. `skills` where `organization_id = O AND project_id IS NULL AND name = 'refactor'`
   → expand if present and `(P, skill.id)` is **not** in
   `skill_project_overrides`.
3. `skills` where `user_id = U AND project_id IS NULL AND organization_id IS NULL AND name = 'refactor'`
   → expand if present and `(P, skill.id)` is **not** in
   `skill_project_overrides`.
4. Otherwise leave the literal `/refactor` text in the message.

For a thread without a project, step 1 is skipped and the override check
in steps 2–3 is skipped (overrides are project-scoped).

The chain is intentionally per-user at step 3: User A's personal skills
never appear for User B, even when both work in an org-visible Project P.
Project Skills (step 1) and Org-Shared Skills (step 2) appear for everyone
with project / org access respectively.

## Persistence is raw

User messages are stored as the user typed them (`/refactor make foo
faster`), not as the expanded text. Expansion happens server-side on every
send to the model — including re-rolls of past turns.

This means editing a Skill silently changes what the model sees on re-roll
of past turns that referenced it. We considered snapshotting the resolved
text per message. Rejected because:

- It matches how editing `custom_instruction` already behaves at send time
  — there is no per-turn snapshot of the system prompt either.
- ADR-0003's "past turns are immutable" invariant is about *thread
  membership* (moving a thread out of a project), not about edit
  immutability of the inputs.
- Snapshotting requires either a side-table or duplicated text on every
  message, plus a UI decision about when to show the chip vs the expanded
  body.
- The slash-with-tail input model from this ADR ("Each `/skillname` token
  is substituted in place by its skill body; surrounding text is preserved")
  is also non-trivial to render after-the-fact from a snapshot without
  extra metadata.

If a real "lock the prompt that produced this assistant turn" need shows
up later, a snapshot column is additive.

## Invocation grammar

Slash tokens are recognised when:

- preceded by start-of-string, whitespace, or newline,
- followed by `[a-zA-Z0-9_-]+` of length 1–32,
- terminated by whitespace, newline, end-of-string, or punctuation that is
  not part of the name,
- **not** inside a fenced code block (` ``` …`` ```) or inline backticks.

Multiple slash tokens in one message all expand. Each is replaced in
place; surrounding text is preserved verbatim.

Skill names are matched case-insensitively but stored as the user typed
them. `[a-zA-Z0-9_-]+` excludes dots, slashes, and unicode so paths
(`/usr/bin`) and URLs (`https://...`) parse cleanly without a special
escape.

A token that does not resolve to any visible Skill is left as literal text
and sent to the model unchanged. The composer surfaces this as a UI
warning at compose time; the server does not hard-fail at send time.

## Uniqueness and collisions

Names are unique within their scope:

- `UNIQUE (user_id, name) WHERE project_id IS NULL AND organization_id IS NULL AND deleted_at IS NULL`
- `UNIQUE (project_id, name) WHERE deleted_at IS NULL`
- `UNIQUE (organization_id, name) WHERE organization_id IS NOT NULL AND deleted_at IS NULL`

The org-globals constraint enforces "first-share wins": a member trying to
share a Skill with the same name as an existing Org-Shared Skill gets a
hard error. This keeps the org slash menu a curated, low-collision
namespace and avoids any author-prefix syntax.

For Personal and Project create paths, a name conflict triggers an
auto-suffix (`-1`, `-2`, ...) so quick recreation after soft-delete or
duplicate-name attempts succeed silently rather than crash. Org-share is
the one path that must error explicitly because the user is making a
namespace claim against other members.

## Project override list

`skill_project_overrides` is a sparse `(project_id, skill_id)` join table.
A row means "this global is hidden in this project's slash menu and is
skipped during resolution." Allow-by-default; the project owner toggles
specific globals off. There is no allow-list — global Skills are usable in
every project unless explicitly hidden, matching the user-facing phrase
*"top-level skills can be used on any project unless specified
otherwise."*

The override applies uniformly to Personal and Org-Shared globals: the
project owner curates the slash menu in their project regardless of source.
A non-owner with project access cannot create overrides; this is a known
v1 limitation (a non-owner who wants to silence their own personal global
in someone else's project must rename or delete it).

## Soft delete and cascade

Skills use the same Windows-folder cascade as projects (ADR-0001):

- Skill deletion is soft (`deleted_at`).
- A soft-deleted project's skills become invisible via the join, mirroring
  threads and attachments. The skill rows do not need their own
  `deleted_at` set during a project cascade.
- Unsharing a Personal Skill clears `organization_id`; the row stays.
- When a user leaves an org, Org-Shared Skills authored by them disappear
  for the org (they remain in the user's personal pool).

Unique indexes are partial on `deleted_at IS NULL` so a deleted name
frees up its slot.
