# Soft-delete Projects, no restore UI in v1

Deleting a Project sets `projects.deleted_at` (a Unix-millis timestamp) instead
of removing the row. All Project-related queries — sidebar listing, settings,
RAG retrieval, thread→project resolution — must filter on `deleted_at IS NULL`.
Threads and attachments belonging to a soft-deleted Project keep their
`project_id` intact; the UI treats them as if they were unprojected by joining
through the `deleted_at` filter.

Considered hard cascade and `SET NULL`-on-delete; both throw away information
we cannot recover. Soft-delete preserves the full graph (Threads, attachments,
RAG corpus references) so an accidental delete is recoverable via the database
or a future restore feature, without any data migration. The cost is one extra
clause in every project-related query and a small amount of dead storage in
Postgres + Qdrant; both are acceptable.

There is no restore UI in v1. From the user's perspective, delete is final;
recovery is a support / DB-script operation. Adding a restore UI later requires
no schema change.
