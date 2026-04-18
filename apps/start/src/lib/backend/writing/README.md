# Writing Workspace Backend

## Purpose

This domain implements Rift's markdown-first writing workspace. It gives the AI
agent coding-agent-shaped tools like `ls`, `read`, `edit`, and `apply_patch`,
but all state lives inside Rift's own database-backed workspace model rather
than a real filesystem or shell sandbox.

## Layout

- `domain/`: tagged errors for project, chat, persistence, conflict, and agent failures.
- `services/`: project, workspace, snapshot, change-set, chat, and PI-agent orchestration.
- `runtime/`: the single runtime used by routes and server functions.

## Data Model

The workspace uses a materialized live tree plus immutable history:

- `writing_projects`: top-level project metadata and current head snapshot.
- `writing_entries`: the current working tree, one row per file or folder.
- `writing_blobs`: immutable markdown content bodies.
- `writing_snapshots` + `writing_snapshot_entries`: durable checkpoint manifests.
- `writing_project_chats` + `writing_chat_messages`: project-local AI conversations.
- `writing_change_sets`, `writing_changes`, `writing_change_hunks`: pending AI edits with per-hunk review.
- `user_skills`, `writing_project_skill_links`: v1 placeholders for future user-global skills.

## Core Flows

### Manual edits

`WritingSnapshotService.manualSaveFile` writes a new blob, updates the live tree,
captures the full manifest, creates a new snapshot, and moves the project head.

### AI edits

`WritingAgentService` creates a change set, runs PI with Rift-native fake tools,
and stores file edits as pending `writing_changes` and `writing_change_hunks`.
Nothing touches the canonical head until the user accepts hunks or auto-accept
is enabled.

### Hunk review

`WritingChangeSetService.acceptHunks` applies only the selected hunks against the
recorded base blobs. If the live tree no longer matches the hunk base, those
hunks become conflicted instead of silently overwriting newer edits.

### Restore

`WritingSnapshotService.restoreSnapshot` rewrites the live tree to a prior
snapshot manifest and creates a new `restore` snapshot so history remains
append-only.

## PI Integration Notes

The writing agent uses `@mariozechner/pi-coding-agent` in SDK mode with:

- `createAgentSession`
- in-memory sessions/settings
- a custom resource loader
- Rift-defined fake tools only

This keeps the tool surface familiar to frontier coding models while preserving
Rift as the canonical storage layer.

## Future Skills

v1 keeps skills intentionally thin. `UserSkillRegistryService` already exists so
future work can load user-global skills into the agent prompt without changing
project, chat, snapshot, or change-set tables.
