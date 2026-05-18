# Issue tracker: Linear

Issues and PRDs for this repo live in [Linear](https://linear.app/ucompound). Use the [`linear`](https://github.com/schpet/linear-cli) CLI (`@schpet/linear-cli`) for all operations. Default team key: **`COM`**.

`linear-cli` is git-aware: it derives the current issue from the branch name (e.g. `com-123-add-auth`). When a skill says "the current issue", trust the CLI's branch detection unless the user supplies an explicit ID.

## Conventions

- **Create an issue**: `linear issue create -t "title" -d "description"`. Pipe long descriptions from a heredoc or file. Add `--project "<name>"` and `--milestone "<name>"` when relevant.
- **Read an issue**: `linear issue view <COM-N>` for terminal markdown, or `linear issue view <COM-N> --json` for structured data when parsing fields.
- **List / search issues**: `linear issue query --search "<text>" --json` for searching the team. Use `linear issue query --all-teams --json` to widen scope. Use `linear issue list -s <state>` for state-filtered lists.
- **Comment on an issue**: `linear issue comment add <COM-N> -b "..."` (or omit the ID to comment on the current branch's issue).
- **Apply / remove labels**: `linear label` subcommands manage labels. Apply with `linear issue update <COM-N> --label "<name>"`. Removal flag varies by version, check `linear issue update --help`.
- **Change state**: `linear issue update <COM-N> --state "<state-name>"` (e.g. `Triage`, `Backlog`, `Todo`, `In Progress`, `Done`, `Canceled`).
- **Close / cancel**: set state to `Done` or `Canceled` via `linear issue update`.
- **Raw GraphQL fallback**: `linear api '<query>'` for anything not covered by a subcommand. Schema: `linear schema`.

`linear-cli` reads `.linear.toml` for the team and workspace; `linear config` regenerates it. The repo's config sets `team_id = "COM"`, `workspace = "ucompound"`, and `issue_sort = "manual"`.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the `COM` team. If the skill specifies a triage role, apply the matching label from `docs/agents/triage-labels.md`. If the skill produced a PRD that's longer than ~2K characters, prefer `linear document create --title "<PRD title>" --content-file <path>` and link the doc from the issue body.

## When a skill says "fetch the relevant ticket"

Resolve the issue ID by checking the current branch (`linear issue id`) or by accepting one from the user, then run `linear issue view <COM-N> --json`.

## Auth note

The CLI needs `linear auth login` to be run once per workspace. If a command errors with auth, surface the message and ask the user to authenticate, don't try to work around it.
